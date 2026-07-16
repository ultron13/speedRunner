package server

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/belo/speedrunner/backend/internal/ai"
	"github.com/belo/speedrunner/backend/internal/cost"
	"github.com/belo/speedrunner/backend/internal/engine"
	"github.com/belo/speedrunner/backend/internal/gitops"
	"github.com/belo/speedrunner/backend/internal/impact"
	"github.com/belo/speedrunner/backend/internal/keda"
	"github.com/belo/speedrunner/backend/internal/operator"
	"github.com/belo/speedrunner/backend/internal/testdata"
)

// ── 4.1 Engine catalog ──────────────────────────────────────────────────────

func (s *Server) listEnginesHandler(w http.ResponseWriter, r *http.Request) {
	catalog := engine.Catalog()
	available := map[string]bool{"simulate": true, "http": true}
	if s.Runner != nil {
		for _, n := range s.Runner.Engines() {
			available[n] = true
		}
	}
	for i := range catalog {
		catalog[i].Available = available[catalog[i].Name]
	}
	writeJSON(w, http.StatusOK, catalog)
}

// ── 4.2 Operator TestRun CR API ─────────────────────────────────────────────

func (s *Server) listOperatorRunsHandler(w http.ResponseWriter, r *http.Request) {
	if s.Operator == nil {
		writeJSON(w, http.StatusOK, []interface{}{})
		return
	}
	writeJSON(w, http.StatusOK, s.Operator.List())
}

func (s *Server) createOperatorRunHandler(w http.ResponseWriter, r *http.Request) {
	if s.Operator == nil {
		writeError(w, http.StatusServiceUnavailable, "operator not available")
		return
	}
	var spec operator.TestRunSpec
	if err := json.NewDecoder(r.Body).Decode(&spec); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if spec.TargetURL == "" {
		writeError(w, http.StatusBadRequest, "targetUrl required")
		return
	}
	if spec.VirtualUsers <= 0 {
		spec.VirtualUsers = 10
	}
	st := s.Operator.Upsert(spec)
	s.writeAudit(r, "create", "operator_run", spec.Name)
	writeJSON(w, http.StatusCreated, st)
}

func (s *Server) getOperatorRunHandler(w http.ResponseWriter, r *http.Request) {
	if s.Operator == nil {
		writeError(w, http.StatusServiceUnavailable, "operator not available")
		return
	}
	name := chi.URLParam(r, "name")
	st, ok := s.Operator.GetStatus(name)
	if !ok {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	writeJSON(w, http.StatusOK, st)
}

func (s *Server) deleteOperatorRunHandler(w http.ResponseWriter, r *http.Request) {
	if s.Operator == nil {
		writeError(w, http.StatusServiceUnavailable, "operator not available")
		return
	}
	name := chi.URLParam(r, "name")
	s.Operator.Delete(name)
	s.writeAudit(r, "delete", "operator_run", name)
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

// ── 4.3 KEDA recommendations ────────────────────────────────────────────────

func (s *Server) kedaRecommendHandler(w http.ResponseWriter, r *http.Request) {
	pending, active, vus := 0, 0, 0
	if s.Tests != nil {
		tests, _ := s.Tests.List(r.Context(), "")
		for _, t := range tests {
			if strings.EqualFold(t.Status, "RUNNING") {
				active++
				vus += t.VirtualUsers
			}
		}
	}
	if s.Runner != nil {
		active = max(active, len(s.Runner.ActiveRunIDs()))
	}
	if s.Schedules != nil {
		// approximate pending as enabled schedules due soon — use list length
		list, _ := s.Schedules.List(r.Context(), "")
		pending = len(list) / 4
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"recommendations": keda.Recommend(pending, active, vus, 0),
		"inputs": map[string]int{
			"pendingRuns": pending,
			"activeRuns":  active,
			"activeVUs":   vus,
		},
	})
}

// ── 4.4 Multi-metric anomaly ────────────────────────────────────────────────

type multiAnomalyRequest struct {
	Series map[string]struct {
		History []ai.MetricPoint `json:"history"`
		Current float64          `json:"current"`
	} `json:"series"`
}

func (s *Server) aiMultiAnomalyHandler(w http.ResponseWriter, r *http.Request) {
	var req multiAnomalyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	findings := make([]ai.Finding, 0)
	for metric, srs := range req.Series {
		if f := s.AI.Detect(metric, srs.History, srs.Current); f != nil {
			findings = append(findings, *f)
		}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"anomalyCount": len(findings),
		"findings":     findings,
	})
}

// ── 4.5 Bottleneck correlation ──────────────────────────────────────────────

type correlateRequest struct {
	RunID     string          `json:"runId"`
	ErrorRate float64         `json:"errorRate"`
	AvgRT     float64         `json:"avgResponseTime"`
	Signals   []impact.Signal `json:"signals"`
}

func (s *Server) correlateBottlenecksHandler(w http.ResponseWriter, r *http.Request) {
	var req correlateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if s.Impact == nil {
		s.Impact = impact.NewCorrelator()
	}
	// If no signals provided, synthesize demo signals from error/RT
	signals := req.Signals
	if len(signals) == 0 {
		signals = []impact.Signal{
			{Source: "application", Component: "api", Metric: "cpu", Value: 85, Threshold: 80, Saturated: req.AvgRT > 400},
			{Source: "database", Component: "postgres", Metric: "connections", Value: 90, Threshold: 80, Saturated: req.ErrorRate > 2},
			{Source: "cache", Component: "redis", Metric: "hit_ratio", Value: 0.6, Threshold: 0.9, Saturated: false},
			{Source: "kubernetes", Component: "pods", Metric: "restarts", Value: 2, Threshold: 1, Saturated: req.ErrorRate > 5},
			{Source: "loadgen", Component: "jmeter", Metric: "cpu", Value: 70, Threshold: 85, Saturated: false},
		}
	}
	out := s.Impact.Correlate(req.RunID, signals, req.ErrorRate, req.AvgRT)
	writeJSON(w, http.StatusOK, map[string]interface{}{"bottlenecks": out})
}

// ── 4.6 GitOps export/import ────────────────────────────────────────────────

func (s *Server) exportTestGitOpsHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) {
		return
	}
	id := chi.URLParam(r, "id")
	test, err := s.Tests.Get(r.Context(), id)
	if err != nil || test == nil {
		writeError(w, http.StatusNotFound, "test not found")
		return
	}
	m := gitops.ExportTest(test.Name, test.ProjectID, test.Description, test.ScriptType, test.TargetURL, test.VirtualUsers)
	format := r.URL.Query().Get("format")
	if format == "json" {
		writeJSON(w, http.StatusOK, m)
		return
	}
	w.Header().Set("Content-Type", "application/x-yaml")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(m.ToYAML()))
}

func (s *Server) importTestGitOpsHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) {
		return
	}
	var m gitops.TestManifest
	if err := json.NewDecoder(r.Body).Decode(&m); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON manifest")
		return
	}
	if m.Metadata.Name == "" || m.Spec.TargetURL == "" {
		writeError(w, http.StatusBadRequest, "metadata.name and spec.targetUrl required")
		return
	}
	projectID := m.Spec.ProjectID
	if projectID == "" {
		projects, err := s.Projects.List(r.Context())
		if err != nil || len(projects) == 0 {
			writeError(w, http.StatusBadRequest, "projectId required")
			return
		}
		projectID = projects[0].ID
	}
	script := m.Spec.ScriptType
	if script == "" {
		script = "HTTP"
	}
	test, err := s.Tests.Create(r.Context(), uuid.New().String(), projectID, m.Metadata.Name,
		m.Spec.Description, script, m.Spec.TargetURL, m.Spec.VirtualUsers)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to import test")
		return
	}
	s.writeAudit(r, "import", "test", test.ID)
	writeJSON(w, http.StatusCreated, map[string]interface{}{"test": test, "manifest": m})
}

func (s *Server) driftTestGitOpsHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) {
		return
	}
	id := chi.URLParam(r, "id")
	test, err := s.Tests.Get(r.Context(), id)
	if err != nil || test == nil {
		writeError(w, http.StatusNotFound, "test not found")
		return
	}
	var desired gitops.TestManifest
	if err := json.NewDecoder(r.Body).Decode(&desired); err != nil {
		writeError(w, http.StatusBadRequest, "invalid desired manifest")
		return
	}
	live := gitops.ExportTest(test.Name, test.ProjectID, test.Description, test.ScriptType, test.TargetURL, test.VirtualUsers)
	writeJSON(w, http.StatusOK, gitops.DetectDrift(live, desired))
}

// ── 4.8 Cost schedule recommend ─────────────────────────────────────────────

type costScheduleRequest struct {
	VirtualUsers int    `json:"virtualUsers"`
	DurationSec  int    `json:"durationSec"`
	Engine       string `json:"engine"`
	Urgency      string `json:"urgency"` // low | normal | high
}

func (s *Server) costScheduleRecommendHandler(w http.ResponseWriter, r *http.Request) {
	var req costScheduleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	est := s.Cost.Estimate(cost.EstimateInput{
		VirtualUsers: req.VirtualUsers,
		DurationSec:  req.DurationSec,
		Engine:       req.Engine,
	})
	window := "off-peak (overnight)"
	if req.Urgency == "high" {
		window = "immediate"
	} else if req.Urgency == "normal" {
		window = "next maintenance window"
	}
	// Prefer cheaper region if multi-region registry present
	region := "local"
	if s.Regions != nil {
		if reg, err := s.Regions.PickBest(req.VirtualUsers); err == nil && reg != nil {
			region = reg.Code
		}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"estimate":           est,
		"recommendedWindow":  window,
		"recommendedRegion":  region,
		"governanceNote":     "Cost recommendations never override SLA, approval, or policy guardrails",
		"savingsHint":        "Running off-peak can reduce contended cluster cost by 20–40%",
	})
}

// ── 4.9 Test data pools ─────────────────────────────────────────────────────

func (s *Server) listDataPoolsHandler(w http.ResponseWriter, r *http.Request) {
	if s.DataPools == nil {
		writeJSON(w, http.StatusOK, []interface{}{})
		return
	}
	writeJSON(w, http.StatusOK, s.DataPools.List())
}

func (s *Server) createDataPoolHandler(w http.ResponseWriter, r *http.Request) {
	if s.DataPools == nil {
		writeError(w, http.StatusServiceUnavailable, "data pools unavailable")
		return
	}
	var p testdata.Pool
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if p.Name == "" {
		writeError(w, http.StatusBadRequest, "name required")
		return
	}
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	s.DataPools.Create(&p)
	s.writeAudit(r, "create", "data_pool", p.ID)
	writeJSON(w, http.StatusCreated, p)
}

func (s *Server) preloadDataPoolHandler(w http.ResponseWriter, r *http.Request) {
	if s.DataPools == nil {
		writeError(w, http.StatusServiceUnavailable, "data pools unavailable")
		return
	}
	id := chi.URLParam(r, "id")
	var body struct {
		Count int `json:"count"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if err := s.DataPools.Preload(r.Context(), id, body.Count); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	p, _ := s.DataPools.Get(id)
	s.writeAudit(r, "preload", "data_pool", id)
	writeJSON(w, http.StatusOK, p)
}

func (s *Server) deleteDataPoolHandler(w http.ResponseWriter, r *http.Request) {
	if s.DataPools == nil {
		return
	}
	id := chi.URLParam(r, "id")
	s.DataPools.Delete(id)
	s.writeAudit(r, "delete", "data_pool", id)
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
