package server

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/belo/speedrunner/backend/internal/platform"
)

func (s *Server) ensurePhase14() {
	if s.Annotations == nil {
		s.Annotations = platform.NewAnnotationStore()
	}
	if s.DeadLetters == nil {
		s.DeadLetters = platform.NewDeadLetterQueue()
	}
}

func (s *Server) workspaceTemplatesHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, platform.WorkspaceTemplates())
}

func (s *Server) secretRotationHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Secrets []platform.SecretRotation `json:"secrets"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	now := time.Now()
	out := make([]map[string]interface{}, 0, len(body.Secrets))
	for _, sec := range body.Secrets {
		out = append(out, map[string]interface{}{
			"name": sec.Name, "path": sec.Path, "due": platform.SecretRotationDue(sec, now),
		})
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"results": out})
}

func (s *Server) runAnnotationsHandler(w http.ResponseWriter, r *http.Request) {
	s.ensurePhase14()
	runID := r.URL.Query().Get("runId")
	if r.Method == http.MethodPost {
		var n platform.RunAnnotation
		if err := json.NewDecoder(r.Body).Decode(&n); err != nil {
			writeError(w, http.StatusBadRequest, "invalid body")
			return
		}
		if n.ID == "" {
			n.ID = uuid.New().String()
		}
		if n.Author == "" {
			n.Author = userIDFromContext(r.Context())
		}
		writeJSON(w, http.StatusCreated, s.Annotations.Add(n))
		return
	}
	writeJSON(w, http.StatusOK, s.Annotations.List(runID))
}

func (s *Server) freezeWindowsHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Windows []platform.FreezeWindow `json:"windows"`
		Env     string                  `json:"env"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	frozen, reason := platform.InFreezeWindow(time.Now(), body.Windows, body.Env)
	writeJSON(w, http.StatusOK, map[string]interface{}{"frozen": frozen, "reason": reason})
}

func (s *Server) dependencyImpactHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Edges   []platform.DependencyEdge `json:"edges"`
		Changed string                    `json:"changed"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"changed":  body.Changed,
		"impacted": platform.ImpactedServices(body.Edges, body.Changed),
	})
}

func (s *Server) scorecardHandler(w http.ResponseWriter, r *http.Request) {
	var in platform.ScorecardInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, platform.EngineeringScore(in))
}

func (s *Server) experimentBucketHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Experiment platform.Experiment `json:"experiment"`
		UserKey    string              `json:"userKey"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if body.UserKey == "" {
		body.UserKey = userIDFromContext(r.Context())
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"variant": platform.ExperimentBucket(body.Experiment, body.UserKey),
		"experiment": body.Experiment.ID,
	})
}

func (s *Server) auditExportHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Rows []map[string]string `json:"rows"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if len(body.Rows) == 0 {
		body.Rows = []map[string]string{
			{"timestamp": time.Now().UTC().Format(time.RFC3339), "actor": "admin", "action": "login", "resource": "user", "ip": "127.0.0.1"},
		}
	}
	csv := platform.ExportAuditCSV(body.Rows)
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=audit-export.csv")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(csv))
}

func (s *Server) deadLetterHandler(w http.ResponseWriter, r *http.Request) {
	s.ensurePhase14()
	if r.Method == http.MethodPost {
		var body struct {
			Action string              `json:"action"` // enqueue|requeue
			Item   platform.DeadLetter `json:"item"`
			ID     string              `json:"id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeError(w, http.StatusBadRequest, "invalid body")
			return
		}
		if body.Action == "requeue" {
			item, ok := s.DeadLetters.Requeue(body.ID)
			if !ok {
				writeError(w, http.StatusNotFound, "not found")
				return
			}
			writeJSON(w, http.StatusOK, item)
			return
		}
		if body.Item.ID == "" {
			body.Item.ID = uuid.New().String()
		}
		s.DeadLetters.Enqueue(body.Item)
		writeJSON(w, http.StatusCreated, body.Item)
		return
	}
	writeJSON(w, http.StatusOK, s.DeadLetters.List())
}

func (s *Server) suitePackHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Pack     platform.SuitePack `json:"pack"`
		Priority map[string]int     `json:"priority"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"order": platform.SuitePackOrder(body.Pack, body.Priority),
	})
}

func (s *Server) promotionGateHandler(w http.ResponseWriter, r *http.Request) {
	var p platform.PromotionRequest
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, platform.EvaluatePromotion(p))
}

func (s *Server) secretScanHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Script string `json:"script"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, platform.SecretScanScript(body.Script))
}

func (s *Server) ipAllowlistHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IP   string               `json:"ip"`
		List platform.IPAllowlist `json:"list"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if body.IP == "" {
		body.IP = clientIP(r)
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ip":      body.IP,
		"allowed": platform.IPAllowedByList(body.IP, body.List),
	})
}

func (s *Server) platformPhases14Handler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"wave": "14", "count": 20, "phases": platform.Phase14Catalog(),
	})
}
