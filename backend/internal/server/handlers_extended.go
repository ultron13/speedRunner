package server

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/belo/speedrunner/backend/internal/ai"
	"github.com/belo/speedrunner/backend/internal/api"
	"github.com/belo/speedrunner/backend/internal/cost"
	"github.com/belo/speedrunner/backend/internal/db/queries"
	"github.com/belo/speedrunner/backend/internal/integrations"
)

// ── Schedules ───────────────────────────────────────────────────────────────

type createScheduleRequest struct {
	TestID         string  `json:"testId"`
	Name           string  `json:"name"`
	Frequency      string  `json:"frequency"`
	CronExpression *string `json:"cronExpression"`
	Enabled        *bool   `json:"enabled"`
}

type updateScheduleRequest struct {
	Name           string  `json:"name"`
	Frequency      string  `json:"frequency"`
	CronExpression *string `json:"cronExpression"`
	Enabled        *bool   `json:"enabled"`
}

func (s *Server) listSchedulesHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) {
		return
	}
	if s.Schedules == nil {
		writeJSON(w, http.StatusOK, []interface{}{})
		return
	}
	testID := r.URL.Query().Get("testId")
	list, err := s.Schedules.List(r.Context(), testID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list schedules")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) createScheduleHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) {
		return
	}
	if s.Schedules == nil {
		writeError(w, http.StatusServiceUnavailable, "schedules not available")
		return
	}
	var req createScheduleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.TestID == "" || req.Name == "" {
		writeError(w, http.StatusBadRequest, "testId and name are required")
		return
	}
	test, err := s.Tests.Get(r.Context(), req.TestID)
	if err != nil || test == nil {
		writeError(w, http.StatusBadRequest, "invalid testId")
		return
	}
	freq := strings.ToUpper(req.Frequency)
	if freq == "" {
		freq = "DAILY"
	}
	next := ScheduleNextRun(freq, time.Now())
	sched, err := s.Schedules.Create(r.Context(), uuid.New().String(), req.TestID, req.Name, freq, req.CronExpression, &next)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create schedule")
		return
	}
	s.writeAudit(r, "create", "schedule", sched.ID)
	writeJSON(w, http.StatusCreated, sched)
}

func (s *Server) updateScheduleHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) || s.Schedules == nil {
		return
	}
	id := chi.URLParam(r, "id")
	existing, err := s.Schedules.Get(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update schedule")
		return
	}
	if existing == nil {
		writeError(w, http.StatusNotFound, "schedule not found")
		return
	}
	var req updateScheduleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	name := req.Name
	if name == "" {
		name = existing.Name
	}
	freq := strings.ToUpper(req.Frequency)
	if freq == "" {
		freq = existing.Frequency
	}
	cron := req.CronExpression
	if cron == nil {
		cron = existing.CronExpression
	}
	enabled := existing.Enabled
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	next := ScheduleNextRun(freq, time.Now())
	sched, err := s.Schedules.Update(r.Context(), id, name, freq, cron, enabled, &next)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update schedule")
		return
	}
	s.writeAudit(r, "update", "schedule", id)
	writeJSON(w, http.StatusOK, sched)
}

func (s *Server) deleteScheduleHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) || s.Schedules == nil {
		return
	}
	id := chi.URLParam(r, "id")
	existing, err := s.Schedules.Get(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete schedule")
		return
	}
	if existing == nil {
		writeError(w, http.StatusNotFound, "schedule not found")
		return
	}
	if err := s.Schedules.Delete(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete schedule")
		return
	}
	s.writeAudit(r, "delete", "schedule", id)
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

// ── SLA ─────────────────────────────────────────────────────────────────────

type createSLARequest struct {
	ProjectID string  `json:"projectId"`
	Name      string  `json:"name"`
	Metric    string  `json:"metric"`
	Condition string  `json:"condition"`
	Value     float64 `json:"value"`
}

func (s *Server) listSLAThresholdsHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) || s.SLA == nil {
		writeJSON(w, http.StatusOK, []interface{}{})
		return
	}
	projectID := r.URL.Query().Get("projectId")
	list, err := s.SLA.ListThresholds(r.Context(), projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list SLA thresholds")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) createSLAThresholdHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) || s.SLA == nil {
		return
	}
	var req createSLARequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" || req.Metric == "" {
		writeError(w, http.StatusBadRequest, "name and metric are required")
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
	cond := req.Condition
	if cond == "" {
		cond = "lte"
	}
	t, err := s.SLA.CreateThreshold(r.Context(), uuid.New().String(), projectID, req.Name, req.Metric, cond, req.Value)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create SLA threshold")
		return
	}
	s.writeAudit(r, "create", "sla_threshold", t.ID)
	writeJSON(w, http.StatusCreated, t)
}

func (s *Server) listSLAResultsHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) || s.SLA == nil {
		writeJSON(w, http.StatusOK, []interface{}{})
		return
	}
	runID := r.URL.Query().Get("runId")
	list, err := s.SLA.ListResults(r.Context(), runID, 100)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list SLA results")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) deleteSLAThresholdHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) || s.SLA == nil {
		return
	}
	id := chi.URLParam(r, "id")
	if err := s.SLA.DeleteThreshold(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete SLA threshold")
		return
	}
	s.writeAudit(r, "delete", "sla_threshold", id)
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

// ── Templates ───────────────────────────────────────────────────────────────

type createTemplateRequest struct {
	ProjectID    string `json:"projectId"`
	Name         string `json:"name"`
	Description  string `json:"description"`
	ScriptType   string `json:"scriptType"`
	TargetURL    string `json:"targetUrl"`
	VirtualUsers int    `json:"virtualUsers"`
}

func (s *Server) listTemplatesHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) || s.Templates == nil {
		writeJSON(w, http.StatusOK, []interface{}{})
		return
	}
	projectID := r.URL.Query().Get("projectId")
	list, err := s.Templates.List(r.Context(), projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list templates")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) createTemplateHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) || s.Templates == nil {
		return
	}
	var req createTemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" || req.TargetURL == "" {
		writeError(w, http.StatusBadRequest, "name and targetUrl are required")
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
	scriptType := req.ScriptType
	if scriptType == "" {
		scriptType = "HTTP"
	}
	vus := req.VirtualUsers
	if vus <= 0 {
		vus = 10
	}
	t, err := s.Templates.Create(r.Context(), uuid.New().String(), projectID, req.Name, req.Description, scriptType, req.TargetURL, vus)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create template")
		return
	}
	s.writeAudit(r, "create", "template", t.ID)
	writeJSON(w, http.StatusCreated, t)
}

func (s *Server) applyTemplateHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) || s.Templates == nil {
		return
	}
	id := chi.URLParam(r, "id")
	tmpl, err := s.Templates.Get(r.Context(), id)
	if err != nil || tmpl == nil {
		writeError(w, http.StatusNotFound, "template not found")
		return
	}
	test, err := s.Tests.Create(r.Context(), uuid.New().String(), tmpl.ProjectID, tmpl.Name,
		tmpl.Description, tmpl.ScriptType, tmpl.TargetURL, tmpl.VirtualUsers)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create test from template")
		return
	}
	_ = s.Templates.IncrementUsage(r.Context(), id)
	s.writeAudit(r, "apply", "template", id)
	writeJSON(w, http.StatusCreated, test)
}

func (s *Server) deleteTemplateHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) || s.Templates == nil {
		return
	}
	id := chi.URLParam(r, "id")
	if err := s.Templates.Delete(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete template")
		return
	}
	s.writeAudit(r, "delete", "template", id)
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

// ── API Keys ────────────────────────────────────────────────────────────────

type createAPIKeyRequest struct {
	Name       string `json:"name"`
	ExpiresInDays *int `json:"expiresInDays"`
}

func (s *Server) listAPIKeysHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) || s.APIKeys == nil {
		writeJSON(w, http.StatusOK, []interface{}{})
		return
	}
	uid := userIDFromContext(r.Context())
	list, err := s.APIKeys.ListByUser(r.Context(), uid)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list API keys")
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (s *Server) createAPIKeyHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) || s.APIKeys == nil {
		return
	}
	var req createAPIKeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	raw, err := generateAPIKey()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate key")
		return
	}
	hash := queries.HashAPIKey(raw)
	uid := userIDFromContext(r.Context())
	var expires *time.Time
	if req.ExpiresInDays != nil && *req.ExpiresInDays > 0 {
		t := time.Now().AddDate(0, 0, *req.ExpiresInDays)
		expires = &t
	}
	key, err := s.APIKeys.Create(r.Context(), uuid.New().String(), uid, req.Name, hash, expires)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create API key")
		return
	}
	s.writeAudit(r, "create", "api_key", key.ID)
	// Return raw key only once
	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id":        key.ID,
		"name":      key.Name,
		"key":       raw,
		"prefix":    key.Prefix,
		"expiresAt": key.ExpiresAt,
		"createdAt": key.CreatedAt,
		"warning":   "Store this key securely — it will not be shown again",
	})
}

func (s *Server) deleteAPIKeyHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) || s.APIKeys == nil {
		return
	}
	id := chi.URLParam(r, "id")
	uid := userIDFromContext(r.Context())
	if err := s.APIKeys.Delete(r.Context(), id, uid); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete API key")
		return
	}
	s.writeAudit(r, "delete", "api_key", id)
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func generateAPIKey() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "sr_" + hex.EncodeToString(b), nil
}

// ── Cost / AI / Regions / OpenAPI ───────────────────────────────────────────

type costEstimateRequest struct {
	VirtualUsers int     `json:"virtualUsers"`
	DurationSec  int     `json:"durationSec"`
	Engine       string  `json:"engine"`
	NetworkGB    float64 `json:"networkGb"`
	ArtifactGB   float64 `json:"artifactGb"`
}

func (s *Server) costEstimateHandler(w http.ResponseWriter, r *http.Request) {
	var req costEstimateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	est := s.Cost.Estimate(cost.EstimateInput{
		VirtualUsers: req.VirtualUsers,
		DurationSec:  req.DurationSec,
		Engine:       req.Engine,
		NetworkGB:    req.NetworkGB,
		ArtifactGB:   req.ArtifactGB,
	})
	writeJSON(w, http.StatusOK, est)
}

type aiRecommendRequest struct {
	Goal    string `json:"goal"`
	PeakRPS int    `json:"peakRps"`
}

func (s *Server) aiRecommendHandler(w http.ResponseWriter, r *http.Request) {
	var req aiRecommendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	writeJSON(w, http.StatusOK, ai.RecommendLoadProfile(req.Goal, req.PeakRPS))
}

type aiAnomalyRequest struct {
	Metric  string           `json:"metric"`
	History []ai.MetricPoint `json:"history"`
	Current float64          `json:"current"`
}

func (s *Server) aiAnomalyHandler(w http.ResponseWriter, r *http.Request) {
	var req aiAnomalyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	finding := s.AI.Detect(req.Metric, req.History, req.Current)
	if finding == nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{"anomaly": false})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"anomaly": true, "finding": finding})
}

func (s *Server) listRegionsHandler(w http.ResponseWriter, r *http.Request) {
	if s.Regions == nil {
		writeJSON(w, http.StatusOK, []interface{}{})
		return
	}
	writeJSON(w, http.StatusOK, s.Regions.List())
}

func (s *Server) openAPIHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, api.OpenAPIDoc())
}

func (s *Server) listWebhooksHandler(w http.ResponseWriter, r *http.Request) {
	if s.Webhooks == nil {
		writeJSON(w, http.StatusOK, []interface{}{})
		return
	}
	writeJSON(w, http.StatusOK, s.Webhooks.List())
}

type createWebhookRequest struct {
	Name   string   `json:"name"`
	URL    string   `json:"url"`
	Secret string   `json:"secret"`
	Events []string `json:"events"`
}

func (s *Server) createWebhookHandler(w http.ResponseWriter, r *http.Request) {
	if s.Webhooks == nil {
		writeError(w, http.StatusServiceUnavailable, "webhooks not available")
		return
	}
	var req createWebhookRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.URL == "" || req.Name == "" {
		writeError(w, http.StatusBadRequest, "name and url are required")
		return
	}
	id := uuid.New().String()
	s.Webhooks.Register(&integrations.Webhook{
		ID:      id,
		Name:    req.Name,
		URL:     req.URL,
		Secret:  req.Secret,
		Events:  req.Events,
		Enabled: true,
	})
	s.writeAudit(r, "create", "webhook", id)
	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id": id, "name": req.Name, "url": req.URL, "events": req.Events, "enabled": true,
	})
}

func (s *Server) deleteWebhookHandler(w http.ResponseWriter, r *http.Request) {
	if s.Webhooks == nil {
		writeError(w, http.StatusServiceUnavailable, "webhooks not available")
		return
	}
	id := chi.URLParam(r, "id")
	s.Webhooks.Unregister(id)
	s.writeAudit(r, "delete", "webhook", id)
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}
