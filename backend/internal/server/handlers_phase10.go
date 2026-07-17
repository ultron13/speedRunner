package server

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/belo/speedrunner/backend/internal/platform"
)

func (s *Server) ensurePhase10() {
	if s.Splunk == nil {
		s.Splunk = platform.NewSplunkStore()
	}
	if s.OTEL == nil {
		s.OTEL = platform.NewOTELExporter()
	}
	if s.Runtime == nil {
		s.Runtime = platform.NewRuntimeController()
	}
	if s.AWSTemplates == nil {
		s.AWSTemplates = platform.NewAWSTemplateStore()
	}
	if s.PasswordForce == nil {
		s.PasswordForce = platform.NewPasswordForceStore()
	}
	if s.Vault == nil {
		s.Vault = platform.NewVaultStore()
	}
	if s.PasswordPolicy.MinLength == 0 {
		s.PasswordPolicy = platform.DefaultPasswordPolicy()
	}
}

func (s *Server) aviatorHandler(w http.ResponseWriter, r *http.Request) {
	var req platform.AviatorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, platform.AviatorAssist(req))
}

func (s *Server) splunkHandler(w http.ResponseWriter, r *http.Request) {
	s.ensurePhase10()
	if r.Method == http.MethodPost {
		var m platform.SplunkMetric
		if err := json.NewDecoder(r.Body).Decode(&m); err != nil {
			writeError(w, http.StatusBadRequest, "invalid body")
			return
		}
		if m.Service == "" || m.Metric == "" {
			writeError(w, http.StatusBadRequest, "service and metric required")
			return
		}
		s.Splunk.Ingest(m)
		writeJSON(w, http.StatusCreated, m)
		return
	}
	q := r.URL.Query()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"integration": "Cisco Splunk APM",
		"metrics":     s.Splunk.Query(q.Get("service"), q.Get("metric"), 100),
	})
}

func (s *Server) otelHandler(w http.ResponseWriter, r *http.Request) {
	s.ensurePhase10()
	if r.Method == http.MethodPost {
		var body struct {
			Action string              `json:"action"` // configure|export
			Config *platform.OTELConfig `json:"config"`
			Span   *platform.OTELSpan   `json:"span"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeError(w, http.StatusBadRequest, "invalid body")
			return
		}
		if body.Action == "export" && body.Span != nil {
			if body.Span.TraceID == "" {
				body.Span.TraceID = uuid.New().String()
			}
			if body.Span.SpanID == "" {
				body.Span.SpanID = uuid.New().String()[:16]
			}
			writeJSON(w, http.StatusCreated, s.OTEL.ExportSpan(*body.Span))
			return
		}
		if body.Config != nil {
			s.OTEL.Configure(*body.Config)
		}
		writeJSON(w, http.StatusOK, s.OTEL.Config())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"config": s.OTEL.Config(),
		"recent": s.OTEL.Recent(20),
	})
}

func (s *Server) runtimeRunHandler(w http.ResponseWriter, r *http.Request) {
	s.ensurePhase10()
	runID := chi.URLParam(r, "id")
	if runID == "" {
		writeError(w, http.StatusBadRequest, "run id required")
		return
	}
	if r.Method == http.MethodGet {
		if st, ok := s.Runtime.Get(runID); ok {
			writeJSON(w, http.StatusOK, st)
			return
		}
		// auto-ensure for demo if run exists in DB
		target := 100
		writeJSON(w, http.StatusOK, s.Runtime.Ensure(runID, target))
		return
	}
	var body struct {
		Action           string `json:"action"` // ensure|add|stop|rendezvous
		VUsers           int    `json:"vusers"`
		TargetVUs        int    `json:"targetVUs"`
		RendezvousName   string `json:"rendezvousName"`
		RendezvousPolicy string `json:"rendezvousPolicy"`
		RendezvousPct    int    `json:"rendezvousPercent"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	switch body.Action {
	case "ensure":
		t := body.TargetVUs
		if t <= 0 {
			t = body.VUsers
		}
		if t <= 0 {
			t = 50
		}
		writeJSON(w, http.StatusOK, s.Runtime.Ensure(runID, t))
	case "add":
		st, err := s.Runtime.AddVUsers(runID, body.VUsers)
		if err != nil {
			// ensure then retry
			s.Runtime.Ensure(runID, 50)
			st, err = s.Runtime.AddVUsers(runID, body.VUsers)
		}
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, st)
	case "stop":
		s.Runtime.Ensure(runID, 50)
		st, err := s.Runtime.StopVUsers(runID, body.VUsers)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, st)
	case "rendezvous":
		s.Runtime.Ensure(runID, 50)
		st, err := s.Runtime.SetRendezvous(runID, body.RendezvousName, body.RendezvousPolicy, body.RendezvousPct)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, st)
	default:
		writeError(w, http.StatusBadRequest, "action must be ensure|add|stop|rendezvous")
	}
}

func (s *Server) awsTemplatesHandler(w http.ResponseWriter, r *http.Request) {
	s.ensurePhase10()
	if r.Method == http.MethodPost {
		var t platform.AWSCloudTemplate
		if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
			writeError(w, http.StatusBadRequest, "invalid body")
			return
		}
		if t.ID == "" {
			t.ID = uuid.New().String()
		}
		if err := s.AWSTemplates.Upsert(&t); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, t)
		return
	}
	writeJSON(w, http.StatusOK, s.AWSTemplates.List())
}

func (s *Server) passwordPolicyHandler(w http.ResponseWriter, r *http.Request) {
	s.ensurePhase10()
	if r.Method == http.MethodPost {
		var body struct {
			Policy   *platform.PasswordPolicy `json:"policy"`
			Action   string                   `json:"action"` // reset|clear|check
			UserID   string                   `json:"userId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeError(w, http.StatusBadRequest, "invalid body")
			return
		}
		if body.Policy != nil {
			s.PasswordPolicy = *body.Policy
		}
		uid := body.UserID
		if uid == "" {
			uid = userIDFromContext(r.Context())
		}
		switch body.Action {
		case "reset":
			s.PasswordForce.MarkReset(uid)
		case "clear":
			s.PasswordForce.Clear(uid)
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"policy":     s.PasswordPolicy,
			"mustChange": s.PasswordForce.MustChange(uid),
			"userId":     uid,
		})
		return
	}
	uid := userIDFromContext(r.Context())
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"policy":     s.PasswordPolicy,
		"mustChange": s.PasswordForce.MustChange(uid),
		"userId":     uid,
	})
}

func (s *Server) vaultResolveHandler(w http.ResponseWriter, r *http.Request) {
	s.ensurePhase10()
	var body struct {
		Script string            `json:"script"`
		Put    map[string]string `json:"put"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	for k, v := range body.Put {
		s.Vault.Put(k, v)
	}
	resolved, missing := platform.ResolveVaultRefs(body.Script, s.Vault)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"resolved": resolved,
		"missing":  missing,
	})
}

func (s *Server) protocolsHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Model       string `json:"model"`
		Concurrent  int    `json:"concurrent"`
		TokensPerReq int   `json:"tokensPerReq"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	// GET-friendly
	if r.Method == http.MethodGet {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"protocols": platform.ProtocolCatalog(),
			"llmProfile": platform.LLMLoadProfile("gpt-4o-mini", 10, 256),
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"protocols":  platform.ProtocolCatalog(),
		"llmProfile": platform.LLMLoadProfile(body.Model, body.Concurrent, body.TokensPerReq),
	})
}

func (s *Server) epe253FeaturesHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"release":  "OpenText Enterprise Performance Engineering CE 25.3",
		"video":    "https://videos.opentext.com/watch/YuVMox3cGu2Gk2FyoLcJwL",
		"features": platform.EPE253FeatureMap(),
		"phases":   platform.Phase10Catalog(),
		"count":    50,
		"generatedAt": time.Now().UTC(),
	})
}

func (s *Server) platformPhases10Handler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"wave":   "10",
		"count":  50,
		"phases": platform.Phase10Catalog(),
	})
}
