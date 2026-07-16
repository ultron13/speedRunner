package server

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// DB-backed handlers using PostgreSQL queries

type createProjectRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type createTestRequest struct {
	ProjectID    string `json:"project_id"`
	Name         string `json:"name"`
	Description  string `json:"description"`
	ScriptType   string `json:"script_type"`
	TargetURL    string `json:"target_url"`
	VirtualUsers int    `json:"virtual_users"`
}

type createRunRequest struct {
	TestID      string `json:"test_id"`
	TriggerType string `json:"trigger_type"`
}

type createScheduleRequest struct {
	TestID         string `json:"test_id"`
	Name           string `json:"name"`
	Frequency      string `json:"frequency"`
	CronExpression string `json:"cron_expression"`
}

type createSLAThresholdRequest struct {
	ProjectID string  `json:"project_id"`
	Name      string  `json:"name"`
	Metric    string  `json:"metric"`
	Condition string  `json:"condition"`
	Value     float64 `json:"value"`
}

type createTemplateRequest struct {
	ProjectID    string `json:"project_id"`
	Name         string `json:"name"`
	Description  string `json:"description"`
	ScriptType   string `json:"script_type"`
	TargetURL    string `json:"target_url"`
	VirtualUsers int    `json:"virtual_users"`
}

func generateID() string {
	return uuid.New().String()
}

// Project handlers with DB
func (s *Server) createProjectHandlerDB(w http.ResponseWriter, r *http.Request) {
	var req createProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}

	// TODO: Use DB queries when PostgreSQL is connected
	id := generateID()
	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id":          id,
		"name":        req.Name,
		"description": req.Description,
		"created_at":  time.Now(),
		"updated_at":  time.Now(),
	})
}

// Test handlers with DB
func (s *Server) createTestHandlerDB(w http.ResponseWriter, r *http.Request) {
	var req createTestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" || req.TargetURL == "" || req.ProjectID == "" {
		writeError(w, http.StatusBadRequest, "name, project_id, and target_url are required")
		return
	}

	id := generateID()
	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id":            id,
		"project_id":    req.ProjectID,
		"name":          req.Name,
		"description":   req.Description,
		"script_type":   req.ScriptType,
		"target_url":    req.TargetURL,
		"virtual_users": req.VirtualUsers,
		"status":        "IDLE",
		"created_at":    time.Now(),
	})
}

// Run handlers
func (s *Server) createRunHandlerDB(w http.ResponseWriter, r *http.Request) {
	var req createRunRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.TestID == "" {
		writeError(w, http.StatusBadRequest, "test_id is required")
		return
	}

	id := generateID()
	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id":          id,
		"test_id":     req.TestID,
		"status":      "RUNNING",
		"started_at":  time.Now(),
		"trigger_type": req.TriggerType,
	})
}

// SLA handlers
func (s *Server) createSLAThresholdHandlerDB(w http.ResponseWriter, r *http.Request) {
	var req createSLAThresholdRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	id := generateID()
	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id":         id,
		"project_id": req.ProjectID,
		"name":       req.Name,
		"metric":     req.Metric,
		"condition":  req.Condition,
		"value":      req.Value,
		"enabled":    true,
	})
}

// Template handlers
func (s *Server) createTemplateHandlerDB(w http.ResponseWriter, r *http.Request) {
	var req createTemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	id := generateID()
	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id":            id,
		"project_id":    req.ProjectID,
		"name":          req.Name,
		"description":   req.Description,
		"script_type":   req.ScriptType,
		"target_url":    req.TargetURL,
		"virtual_users": req.VirtualUsers,
		"usage_count":   0,
		"created_at":    time.Now(),
	})
}

// Ensure chi import is used
var _ = chi.URLParam
