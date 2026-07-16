package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/belo/speedrunner/backend/internal/db/queries"
)

// ── Dashboard ───────────────────────────────────────────────────────────────

func (s *Server) dashboardSummaryHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) {
		return
	}
	summary, err := queries.DashboardSummaryQuery(r.Context(), s.DB.Pool)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load dashboard summary")
		return
	}
	// Live runner overlay
	if s.Runner != nil {
		active := len(s.Runner.ActiveRunIDs())
		if active > summary.RunningTests {
			summary.RunningTests = active
		}
	}
	writeJSON(w, http.StatusOK, summary)
}

// ── Environments ────────────────────────────────────────────────────────────

type createEnvRequest struct {
	ProjectID string `json:"projectId"`
	Name      string `json:"name"`
	BaseURL   string `json:"baseUrl"`
	Region    string `json:"region"`
}

func (s *Server) listEnvironmentsHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) || s.Environments == nil {
		writeJSON(w, http.StatusOK, []interface{}{})
		return
	}
	list, err := s.Environments.List(r.Context(), r.URL.Query().Get("projectId"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list environments")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) createEnvironmentHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) || s.Environments == nil {
		return
	}
	var req createEnvRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" || req.BaseURL == "" {
		writeError(w, http.StatusBadRequest, "name and baseUrl are required")
		return
	}
	projectID := req.ProjectID
	if projectID == "" {
		projects, err := s.Projects.List(r.Context())
		if err != nil || len(projects) == 0 {
			writeError(w, http.StatusBadRequest, "projectId is required")
			return
		}
		projectID = projects[0].ID
	}
	region := req.Region
	if region == "" {
		region = "local"
	}
	env, err := s.Environments.Create(r.Context(), uuid.New().String(), projectID, req.Name, req.BaseURL, region)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create environment")
		return
	}
	s.writeAudit(r, "create", "environment", env.ID)
	writeJSON(w, http.StatusCreated, env)
}

func (s *Server) deleteEnvironmentHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) || s.Environments == nil {
		return
	}
	id := chi.URLParam(r, "id")
	if err := s.Environments.Delete(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete environment")
		return
	}
	s.writeAudit(r, "delete", "environment", id)
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

// ── Load generator pools ────────────────────────────────────────────────────

type createPoolRequest struct {
	Name        string  `json:"name"`
	Region      string  `json:"region"`
	Engine      string  `json:"engine"`
	CapacityVUs int     `json:"capacityVUs"`
	Namespace   *string `json:"namespace"`
}

func (s *Server) listPoolsHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) || s.Pools == nil {
		writeJSON(w, http.StatusOK, []interface{}{})
		return
	}
	list, err := s.Pools.List(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list pools")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) createPoolHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) || s.Pools == nil {
		return
	}
	var req createPoolRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	if req.CapacityVUs <= 0 {
		req.CapacityVUs = 1000
	}
	if req.Engine == "" {
		req.Engine = "simulate"
	}
	if req.Region == "" {
		req.Region = "local"
	}
	p, err := s.Pools.Create(r.Context(), uuid.New().String(), req.Name, req.Region, req.Engine, req.CapacityVUs, req.Namespace)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create pool")
		return
	}
	s.writeAudit(r, "create", "pool", p.ID)
	writeJSON(w, http.StatusCreated, p)
}

// ── Applications ────────────────────────────────────────────────────────────

type createAppRequest struct {
	ProjectID   string `json:"projectId"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Owner       string `json:"owner"`
}

func (s *Server) listApplicationsHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) || s.Applications == nil {
		writeJSON(w, http.StatusOK, []interface{}{})
		return
	}
	list, err := s.Applications.List(r.Context(), r.URL.Query().Get("projectId"))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list applications")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) createApplicationHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) || s.Applications == nil {
		return
	}
	var req createAppRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	projectID := req.ProjectID
	if projectID == "" {
		projects, err := s.Projects.List(r.Context())
		if err != nil || len(projects) == 0 {
			writeError(w, http.StatusBadRequest, "projectId is required")
			return
		}
		projectID = projects[0].ID
	}
	app, err := s.Applications.Create(r.Context(), uuid.New().String(), projectID, req.Name, req.Description, req.Owner)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create application")
		return
	}
	s.writeAudit(r, "create", "application", app.ID)
	writeJSON(w, http.StatusCreated, app)
}

// ── Reports ─────────────────────────────────────────────────────────────────

type createReportRequest struct {
	RunID      string                 `json:"runId"`
	ProjectID  string                 `json:"projectId"`
	Name       string                 `json:"name"`
	ReportType string                 `json:"reportType"`
	Summary    string                 `json:"summary"`
	Payload    map[string]interface{} `json:"payload"`
}

func (s *Server) listReportsHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) || s.Reports == nil {
		writeJSON(w, http.StatusOK, []interface{}{})
		return
	}
	list, err := s.Reports.List(r.Context(), 50)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list reports")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) createReportHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) || s.Reports == nil {
		return
	}
	var req createReportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	if req.ReportType == "" {
		req.ReportType = "ENGINEERING"
	}

	// Auto-build engineering report from a run when runId provided and no payload
	if req.RunID != "" && req.Payload == nil && s.Runs != nil {
		run, err := s.Runs.Get(r.Context(), req.RunID)
		if err == nil && run != nil {
			req.Payload = map[string]interface{}{
				"runId":           run.ID,
				"testId":          run.TestID,
				"status":          run.Status,
				"duration":        run.Duration,
				"throughput":      run.Throughput,
				"avgResponseTime": run.AvgResponseTime,
				"p50":             run.P50,
				"p90":             run.P90,
				"p95":             run.P95,
				"p99":             run.P99,
				"errorRate":       run.ErrorRate,
				"startedAt":       run.StartedAt,
				"completedAt":     run.CompletedAt,
			}
			if req.Summary == "" {
				avg := 0.0
				if run.AvgResponseTime != nil {
					avg = *run.AvgResponseTime
				}
				errRate := 0.0
				if run.ErrorRate != nil {
					errRate = *run.ErrorRate
				}
				req.Summary = fmt.Sprintf("Run %s %s — avg RT %.0fms, errors %.2f%%",
					run.ID[:8], run.Status, avg, errRate)
			}
		}
	}

	payload, _ := json.Marshal(req.Payload)
	var runID, projectID *string
	if req.RunID != "" {
		runID = &req.RunID
	}
	if req.ProjectID != "" {
		projectID = &req.ProjectID
	}
	rep, err := s.Reports.Create(r.Context(), uuid.New().String(), runID, projectID, req.Name, req.ReportType, req.Summary, payload)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create report")
		return
	}
	s.writeAudit(r, "create", "report", rep.ID)
	writeJSON(w, http.StatusCreated, rep)
}

func (s *Server) getReportHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) || s.Reports == nil {
		return
	}
	id := chi.URLParam(r, "id")
	rep, err := s.Reports.Get(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get report")
		return
	}
	if rep == nil {
		writeError(w, http.StatusNotFound, "report not found")
		return
	}
	writeJSON(w, http.StatusOK, rep)
}

// ── Policy guard on start (used by handlers) ────────────────────────────────

func (s *Server) enforceStartPolicy(w http.ResponseWriter, virtualUsers int, targetURL string) bool {
	maxVUs := 10000
	if s.Config != nil && s.Config.Engine.MaxVUs > 0 {
		maxVUs = s.Config.Engine.MaxVUs
	}
	if virtualUsers > maxVUs {
		writeError(w, http.StatusForbidden, fmt.Sprintf("policy: virtualUsers %d exceeds max %d", virtualUsers, maxVUs))
		return false
	}
	if targetURL == "" {
		writeError(w, http.StatusBadRequest, "policy: target URL required")
		return false
	}
	// Soft guard: require absolute URL-ish target
	if !strings.Contains(targetURL, "://") && !strings.HasPrefix(targetURL, "http") {
		// still allow host-only for jmeter domain mode
	}
	_ = virtualUsers
	return true
}
