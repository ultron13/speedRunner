package server

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/belo/speedrunner/backend/internal/platform"
)

var serverStart = time.Now()

func (s *Server) metricsPrometheusHandler(w http.ResponseWriter, r *http.Request) {
	samples := []platform.MetricSample{
		{Name: "speedrunner_up", Help: "1 if API is up", Type: "gauge", Value: 1},
		{Name: "speedrunner_uptime_seconds", Help: "Process uptime", Type: "gauge", Value: time.Since(serverStart).Seconds()},
	}
	if s.Runner != nil {
		samples = append(samples, platform.MetricSample{
			Name: "speedrunner_active_runs", Help: "Active simulated/engine runs", Type: "gauge",
			Value: float64(len(s.Runner.ActiveRunIDs())),
		})
	}
	if s.Tests != nil {
		if n, err := s.Tests.Count(r.Context()); err == nil {
			samples = append(samples, platform.MetricSample{
				Name: "speedrunner_tests_total", Help: "Total tests", Type: "gauge", Value: float64(n),
			})
		}
	}
	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(platform.PrometheusText(samples)))
}

func (s *Server) featureFlagsHandler(w http.ResponseWriter, r *http.Request) {
	if s.Flags == nil {
		s.Flags = platform.NewFeatureFlags()
	}
	if r.Method == http.MethodPost {
		var body struct {
			Name  string `json:"name"`
			Enabled bool `json:"enabled"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" {
			writeError(w, http.StatusBadRequest, "name required")
			return
		}
		s.Flags.Set(body.Name, body.Enabled)
	}
	writeJSON(w, http.StatusOK, s.Flags.All())
}

func (s *Server) maintenanceHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		var body platform.MaintenanceWindow
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeError(w, http.StatusBadRequest, "invalid body")
			return
		}
		s.Maintenance = body
	}
	active := s.Maintenance.Active(time.Now())
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"window": s.Maintenance,
		"active": active,
	})
}

func (s *Server) executionWindowsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		var body []platform.TimeWindow
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeError(w, http.StatusBadRequest, "invalid body")
			return
		}
		s.ExecWindows = body
	}
	allowed, reason := platform.InExecutionWindow(time.Now(), s.ExecWindows)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"windows": s.ExecWindows,
		"allowedNow": allowed,
		"reason": reason,
	})
}

func (s *Server) listApprovalsHandler(w http.ResponseWriter, r *http.Request) {
	if s.Approvals == nil {
		s.Approvals = platform.NewApprovalStore()
	}
	writeJSON(w, http.StatusOK, s.Approvals.List(r.URL.Query().Get("status")))
}

func (s *Server) createApprovalHandler(w http.ResponseWriter, r *http.Request) {
	if s.Approvals == nil {
		s.Approvals = platform.NewApprovalStore()
	}
	var body platform.Approval
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if body.ID == "" {
		body.ID = uuid.New().String()
	}
	if body.RequestedBy == "" {
		body.RequestedBy = userIDFromContext(r.Context())
	}
	s.Approvals.Request(&body)
	s.writeAudit(r, "request", "approval", body.ID)
	writeJSON(w, http.StatusCreated, body)
}

func (s *Server) decideApprovalHandler(w http.ResponseWriter, r *http.Request) {
	if s.Approvals == nil {
		writeError(w, http.StatusNotFound, "no approvals")
		return
	}
	id := chi.URLParam(r, "id")
	var body struct {
		Status string `json:"status"`
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if body.Status != "APPROVED" && body.Status != "REJECTED" {
		writeError(w, http.StatusBadRequest, "status must be APPROVED or REJECTED")
		return
	}
	if err := s.Approvals.Decide(id, body.Status, userIDFromContext(r.Context()), body.Reason); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	s.writeAudit(r, "decide", "approval", id)
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (s *Server) compareRunsHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Baseline  platform.RunSnapshot `json:"baseline"`
		Candidate platform.RunSnapshot `json:"candidate"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	// Optionally hydrate from DB if only IDs provided
	if body.Baseline.RunID != "" && body.Baseline.AvgResponseTime == 0 && s.Runs != nil {
		if run, err := s.Runs.Get(r.Context(), body.Baseline.RunID); err == nil && run != nil {
			body.Baseline = snapshotFromRun(run.ID, run.AvgResponseTime, run.P95, run.Throughput, run.ErrorRate)
		}
	}
	if body.Candidate.RunID != "" && body.Candidate.AvgResponseTime == 0 && s.Runs != nil {
		if run, err := s.Runs.Get(r.Context(), body.Candidate.RunID); err == nil && run != nil {
			body.Candidate = snapshotFromRun(run.ID, run.AvgResponseTime, run.P95, run.Throughput, run.ErrorRate)
		}
	}
	writeJSON(w, http.StatusOK, platform.CompareRuns(body.Baseline, body.Candidate))
}

func snapshotFromRun(id string, avg, p95, tp, er *float64) platform.RunSnapshot {
	s := platform.RunSnapshot{RunID: id}
	if avg != nil {
		s.AvgResponseTime = *avg
	}
	if p95 != nil {
		s.P95 = *p95
	}
	if tp != nil {
		s.Throughput = *tp
	}
	if er != nil {
		s.ErrorRate = *er
	}
	return s
}

func (s *Server) trendAggregateHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Points        []platform.TrendPoint `json:"points"`
		BucketMinutes int                   `json:"bucketMinutes"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, platform.AggregateTrend(body.Points, body.BucketMinutes))
}

func (s *Server) notificationsHandler(w http.ResponseWriter, r *http.Request) {
	if s.Notifications == nil {
		s.Notifications = platform.NewNotificationBus()
	}
	if r.Method == http.MethodPost {
		var n platform.Notification
		if err := json.NewDecoder(r.Body).Decode(&n); err != nil {
			writeError(w, http.StatusBadRequest, "invalid body")
			return
		}
		if n.ID == "" {
			n.ID = uuid.New().String()
		}
		n = s.Notifications.Publish(n)
		writeJSON(w, http.StatusCreated, n)
		return
	}
	writeJSON(w, http.StatusOK, s.Notifications.Recent(50))
}

func (s *Server) artifactsHandler(w http.ResponseWriter, r *http.Request) {
	if s.Artifacts == nil {
		s.Artifacts = platform.NewArtifactStore()
	}
	if r.Method == http.MethodPost {
		var a platform.Artifact
		if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
			writeError(w, http.StatusBadRequest, "invalid body")
			return
		}
		if a.ID == "" {
			a.ID = uuid.New().String()
		}
		s.Artifacts.Put(&a)
		writeJSON(w, http.StatusCreated, a)
		return
	}
	runID := r.URL.Query().Get("runId")
	writeJSON(w, http.StatusOK, s.Artifacts.ListByRun(runID))
}

func (s *Server) securityUtilsHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Text      string   `json:"text"`
		IP        string   `json:"ip"`
		Allowlist []string `json:"allowlist"`
		Password  string   `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	ok, score, issues := platform.PasswordStrength(body.Password)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"redacted":         platform.RedactSecrets(body.Text),
		"ipAllowed":        platform.IPAllowed(body.IP, body.Allowlist),
		"passwordOk":       ok,
		"passwordScore":    score,
		"passwordIssues":   issues,
		"tokenHashExample": platform.HashToken("example"),
	})
}

func (s *Server) chargebackHandler(w http.ResponseWriter, r *http.Request) {
	var lines []platform.ChargebackLine
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&lines)
	}
	if len(lines) == 0 {
		lines = []platform.ChargebackLine{
			{Team: "platform", Project: "Default", VUHours: 12, CostUSD: 40, Runs: 8},
			{Team: "commerce", Project: "Checkout", VUHours: 30, CostUSD: 95, Runs: 15},
		}
	}
	writeJSON(w, http.StatusOK, platform.BuildChargeback(lines))
}

func (s *Server) retentionHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, platform.DefaultRetention())
}

func (s *Server) workloadsHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, platform.DefaultWorkloadProfiles())
}

func (s *Server) journeysHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, platform.BrowserJourneys())
}

func (s *Server) releaseBoardHandler(w http.ResponseWriter, r *http.Request) {
	var items []platform.ReleaseBoardItem
	if err := json.NewDecoder(r.Body).Decode(&items); err != nil {
		// default demo board
		items = []platform.ReleaseBoardItem{
			{Service: "api-gateway", Gate: "PASS", Risk: "low", Note: "p95 within SLA"},
			{Service: "checkout", Gate: "WARN", Risk: "medium", Note: "error rate elevated"},
		}
	}
	writeJSON(w, http.StatusOK, platform.BuildReleaseBoard(items))
}

func (s *Server) healthMatrixHandler(w http.ResponseWriter, r *http.Request) {
	dbOK, redisOK, k8sOK := false, false, s.K8s != nil
	if s.DB != nil {
		dbOK = s.DB.Pool.Ping(r.Context()) == nil
	}
	if s.Redis != nil {
		redisOK = s.Redis.Ping(r.Context()) == nil
	}
	components := platform.HealthMatrix(dbOK, redisOK, k8sOK, true)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"components": components,
		"diagnostics": platform.DiagnosticBundle("0.4.0", time.Since(serverStart).Seconds(), components),
	})
}

func (s *Server) platformPhasesHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"wave":   "7",
		"count":  50,
		"phases": platform.PhaseCatalog(),
	})
}
