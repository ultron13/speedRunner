package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/belo/speedrunner/backend/internal/auth"
)

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type registerRequest struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

type userResponse struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	Role      string `json:"role"`
	CreatedAt string `json:"createdAt,omitempty"`
}

type tokenResponse struct {
	Token string       `json:"token"`
	User  userResponse `json:"user"`
}

type createProjectRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type createTestRequest struct {
	ProjectID    string `json:"projectId"`
	Name         string `json:"name"`
	Description  string `json:"description"`
	ScriptType   string `json:"scriptType"`
	TargetURL    string `json:"targetUrl"`
	VirtualUsers int    `json:"virtualUsers"`
}

type updateTestRequest struct {
	Name         string `json:"name"`
	Description  string `json:"description"`
	ScriptType   string `json:"scriptType"`
	TargetURL    string `json:"targetUrl"`
	VirtualUsers int    `json:"virtualUsers"`
}

type createRunRequest struct {
	TestID      string `json:"testId"`
	TriggerType string `json:"triggerType"`
}

func (s *Server) requireDB(w http.ResponseWriter) bool {
	if s.DB == nil || s.Users == nil {
		writeError(w, http.StatusServiceUnavailable, "database not configured")
		return false
	}
	return true
}

func (s *Server) writeAudit(r *http.Request, action, resourceType, resourceID string) {
	if s.Audit == nil {
		return
	}
	uid := userIDFromContext(r.Context())
	var userID *string
	if uid != "" {
		userID = &uid
	}
	var resID *string
	if resourceID != "" {
		resID = &resourceID
	}
	ip := clientIP(r)
	ipPtr := &ip
	details := `{}`
	_ = s.Audit.Create(r.Context(), userID, action, resourceType, resID, &details, ipPtr)
}

// ── Auth ────────────────────────────────────────────────────────────────────

func (s *Server) loginHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) {
		return
	}

	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "email and password are required")
		return
	}

	user, err := s.Users.GetByEmail(r.Context(), req.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "login failed")
		return
	}
	if user == nil {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  user.ID,
		"role": user.Role,
		"exp":  time.Now().Add(time.Duration(s.Config.JWT.ExpireHour) * time.Hour).Unix(),
	})

	tokenStr, err := token.SignedString([]byte(s.Config.JWT.Secret))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate token")
		return
	}

	s.writeAudit(r, "login", "user", user.ID)

	writeJSON(w, http.StatusOK, tokenResponse{
		Token: tokenStr,
		User: userResponse{
			ID:        user.ID,
			Email:     user.Email,
			Name:      user.Name,
			Role:      user.Role,
			CreatedAt: user.CreatedAt.UTC().Format(time.RFC3339),
		},
	})
}

func (s *Server) registerHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) {
		return
	}

	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Name = strings.TrimSpace(req.Name)
	if req.Email == "" || req.Name == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "email, name, and password are required")
		return
	}
	if len(req.Password) < 6 {
		writeError(w, http.StatusBadRequest, "password must be at least 6 characters")
		return
	}

	existing, err := s.Users.GetByEmail(r.Context(), req.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "registration failed")
		return
	}
	if existing != nil {
		writeError(w, http.StatusConflict, "email already registered")
		return
	}

	role := req.Role
	if role == "" {
		role = string(auth.RoleReadOnly)
	}
	if !auth.IsValidRole(role) {
		writeError(w, http.StatusBadRequest, "invalid role")
		return
	}
	// Only allow self-registration as READ_ONLY unless seeded admin path
	if role != string(auth.RoleReadOnly) {
		role = string(auth.RoleReadOnly)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to hash password")
		return
	}

	user, err := s.Users.Create(r.Context(), uuid.New().String(), req.Email, req.Name, string(hash), role)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create user")
		return
	}

	s.writeAudit(r, "register", "user", user.ID)

	writeJSON(w, http.StatusCreated, userResponse{
		ID:        user.ID,
		Email:     user.Email,
		Name:      user.Name,
		Role:      user.Role,
		CreatedAt: user.CreatedAt.UTC().Format(time.RFC3339),
	})
}

func (s *Server) meHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) {
		return
	}

	userID := userIDFromContext(r.Context())
	user, err := s.Users.GetByID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load user")
		return
	}
	if user == nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}

	writeJSON(w, http.StatusOK, userResponse{
		ID:        user.ID,
		Email:     user.Email,
		Name:      user.Name,
		Role:      user.Role,
		CreatedAt: user.CreatedAt.UTC().Format(time.RFC3339),
	})
}

// ── Projects ────────────────────────────────────────────────────────────────

func (s *Server) listProjectsHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) {
		return
	}
	projects, err := s.Projects.List(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list projects")
		return
	}
	writeJSON(w, http.StatusOK, projects)
}

func (s *Server) createProjectHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) {
		return
	}
	var req createProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}

	project, err := s.Projects.Create(r.Context(), uuid.New().String(), req.Name, req.Description)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create project")
		return
	}
	s.writeAudit(r, "create", "project", project.ID)
	writeJSON(w, http.StatusCreated, project)
}

func (s *Server) getProjectHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) {
		return
	}
	id := chi.URLParam(r, "id")
	project, err := s.Projects.Get(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get project")
		return
	}
	if project == nil {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}
	writeJSON(w, http.StatusOK, project)
}

func (s *Server) updateProjectHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) {
		return
	}
	id := chi.URLParam(r, "id")
	var req createProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}

	project, err := s.Projects.Update(r.Context(), id, req.Name, req.Description)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update project")
		return
	}
	if project == nil {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}
	s.writeAudit(r, "update", "project", project.ID)
	writeJSON(w, http.StatusOK, project)
}

func (s *Server) deleteProjectHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) {
		return
	}
	id := chi.URLParam(r, "id")
	existing, err := s.Projects.Get(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete project")
		return
	}
	if existing == nil {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}
	if err := s.Projects.Delete(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete project")
		return
	}
	s.writeAudit(r, "delete", "project", id)
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

// ── Tests ───────────────────────────────────────────────────────────────────

func (s *Server) listTestsHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) {
		return
	}
	projectID := r.URL.Query().Get("projectId")
	if projectID == "" {
		projectID = r.URL.Query().Get("project_id")
	}
	tests, err := s.Tests.List(r.Context(), projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list tests")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"tests":  tests,
		"total":  len(tests),
		"limit":  len(tests),
		"offset": 0,
	})
}

func (s *Server) createTestHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) {
		return
	}
	var req createTestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	req.TargetURL = strings.TrimSpace(req.TargetURL)
	if req.Name == "" || req.TargetURL == "" {
		writeError(w, http.StatusBadRequest, "name and targetUrl are required")
		return
	}
	if req.VirtualUsers <= 0 {
		req.VirtualUsers = s.Config.Engine.DefaultVUs
	}
	if req.VirtualUsers > s.Config.Engine.MaxVUs {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("virtualUsers cannot exceed %d", s.Config.Engine.MaxVUs))
		return
	}
	if req.ScriptType == "" {
		req.ScriptType = "HTTP"
	}

	projectID := req.ProjectID
	if projectID == "" {
		// Auto-create or reuse default project
		projects, err := s.Projects.List(r.Context())
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to resolve project")
			return
		}
		if len(projects) == 0 {
			p, err := s.Projects.Create(r.Context(), uuid.New().String(), "Default Project", "Auto-created project")
			if err != nil {
				writeError(w, http.StatusInternalServerError, "failed to create default project")
				return
			}
			projectID = p.ID
		} else {
			projectID = projects[0].ID
		}
	} else {
		p, err := s.Projects.Get(r.Context(), projectID)
		if err != nil || p == nil {
			writeError(w, http.StatusBadRequest, "invalid projectId")
			return
		}
	}

	test, err := s.Tests.Create(r.Context(), uuid.New().String(), projectID, req.Name, req.Description,
		req.ScriptType, req.TargetURL, req.VirtualUsers)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create test")
		return
	}
	s.writeAudit(r, "create", "test", test.ID)
	writeJSON(w, http.StatusCreated, test)
}

func (s *Server) getTestHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) {
		return
	}
	id := chi.URLParam(r, "id")
	test, err := s.Tests.Get(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get test")
		return
	}
	if test == nil {
		writeError(w, http.StatusNotFound, "test not found")
		return
	}
	writeJSON(w, http.StatusOK, test)
}

func (s *Server) updateTestHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) {
		return
	}
	id := chi.URLParam(r, "id")
	existing, err := s.Tests.Get(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update test")
		return
	}
	if existing == nil {
		writeError(w, http.StatusNotFound, "test not found")
		return
	}

	var req updateTestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" {
		req.Name = existing.Name
	}
	if req.Description == "" {
		req.Description = existing.Description
	}
	if req.ScriptType == "" {
		req.ScriptType = existing.ScriptType
	}
	if req.TargetURL == "" {
		req.TargetURL = existing.TargetURL
	}
	if req.VirtualUsers <= 0 {
		req.VirtualUsers = existing.VirtualUsers
	}

	test, err := s.Tests.Update(r.Context(), id, req.Name, req.Description, req.ScriptType, req.TargetURL, req.VirtualUsers)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update test")
		return
	}
	s.writeAudit(r, "update", "test", id)
	writeJSON(w, http.StatusOK, test)
}

func (s *Server) deleteTestHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) {
		return
	}
	id := chi.URLParam(r, "id")
	existing, err := s.Tests.Get(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete test")
		return
	}
	if existing == nil {
		writeError(w, http.StatusNotFound, "test not found")
		return
	}
	if strings.EqualFold(existing.Status, "RUNNING") {
		writeError(w, http.StatusConflict, "cannot delete a running test; stop it first")
		return
	}
	if err := s.Tests.Delete(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete test")
		return
	}
	s.writeAudit(r, "delete", "test", id)
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (s *Server) startTestHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) {
		return
	}
	id := chi.URLParam(r, "id")
	test, err := s.Tests.Get(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to start test")
		return
	}
	if test == nil {
		writeError(w, http.StatusNotFound, "test not found")
		return
	}
	if strings.EqualFold(test.Status, "RUNNING") {
		writeError(w, http.StatusConflict, "test is already running")
		return
	}
	if !s.enforceStartPolicy(w, test.VirtualUsers, test.TargetURL) {
		return
	}

	// Reserve load generator pool capacity when available
	if s.Pools != nil {
		if pool, err := s.Pools.PickBest(r.Context(), test.VirtualUsers, ""); err == nil && pool != nil {
			if err := s.Pools.Reserve(r.Context(), pool.ID, test.VirtualUsers); err != nil {
				writeError(w, http.StatusConflict, "insufficient load generator capacity: "+err.Error())
				return
			}
			// Release is best-effort on stop via deferred pattern in stop handler
			if s.Redis != nil {
				_ = s.Redis.Set(r.Context(), "speedrunner:run:pool:"+test.ID, pool.ID, 24*time.Hour)
			}
		}
	}

	userID := userIDFromContext(r.Context())
	var triggeredBy *string
	if userID != "" {
		triggeredBy = &userID
	}

	run, err := s.Runs.Create(r.Context(), uuid.New().String(), id, "MANUAL", triggeredBy)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create run")
		return
	}
	if err := s.Tests.UpdateStatus(r.Context(), id, "RUNNING"); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update test status")
		return
	}
	_ = s.Tests.SetLastRun(r.Context(), id)

	// Start simulation engine (persists metrics every second)
	if s.Runner != nil {
		if err := s.Runner.Start(r.Context(), run.ID, test); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to start simulation engine")
			return
		}
	} else if s.Redis != nil {
		_ = s.Redis.Set(r.Context(), redisStatusKey(run.ID), "RUNNING", 24*time.Hour)
	}

	engineMode := "simulate"
	if s.Runner != nil {
		engineMode = s.Runner.Mode()
		if info, ok := s.Runner.RunInfo(run.ID); ok {
			engineMode = info.engineName
		}
	}

	s.writeAudit(r, "start", "test", id)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"run":    run,
		"testId": id,
		"status": "RUNNING",
		"mode":   engineMode,
		"engine": engineMode,
	})
}

func (s *Server) stopTestHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) {
		return
	}
	id := chi.URLParam(r, "id")
	test, err := s.Tests.Get(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to stop test")
		return
	}
	if test == nil {
		writeError(w, http.StatusNotFound, "test not found")
		return
	}
	if !strings.EqualFold(test.Status, "RUNNING") {
		writeError(w, http.StatusConflict, "test is not running")
		return
	}

	active, err := s.Runs.GetActiveByTestID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to find active run")
		return
	}
	if active != nil {
		if s.Runner != nil {
			if err := s.Runner.Stop(r.Context(), active.ID, "STOPPED"); err != nil {
				writeError(w, http.StatusInternalServerError, "failed to stop run")
				return
			}
		} else {
			if err := s.Runs.Stop(r.Context(), active.ID); err != nil {
				writeError(w, http.StatusInternalServerError, "failed to stop run")
				return
			}
			if s.Redis != nil {
				_ = s.Redis.Set(r.Context(), redisStatusKey(active.ID), "STOPPED", 24*time.Hour)
			}
		}
	}

	if err := s.Tests.UpdateStatus(r.Context(), id, "STOPPED"); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update test status")
		return
	}

	var runID interface{}
	if active != nil {
		runID = active.ID
	}

	s.writeAudit(r, "stop", "test", id)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"testId":  id,
		"status":  "STOPPED",
		"runId":   runID,
	})
}

func redisStatusKey(runID string) string {
	return fmt.Sprintf("speedrunner:run:%s:status", runID)
}

// ── Runs ────────────────────────────────────────────────────────────────────

func (s *Server) listRunsHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) {
		return
	}
	testID := r.URL.Query().Get("testId")
	if testID == "" {
		testID = r.URL.Query().Get("test_id")
	}
	runs, err := s.Runs.List(r.Context(), testID, 100)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list runs")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"runs":  runs,
		"total": len(runs),
	})
}

func (s *Server) createRunHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) {
		return
	}
	var req createRunRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.TestID == "" {
		writeError(w, http.StatusBadRequest, "testId is required")
		return
	}
	test, err := s.Tests.Get(r.Context(), req.TestID)
	if err != nil || test == nil {
		writeError(w, http.StatusBadRequest, "invalid testId")
		return
	}
	triggerType := req.TriggerType
	if triggerType == "" {
		triggerType = "MANUAL"
	}
	userID := userIDFromContext(r.Context())
	var triggeredBy *string
	if userID != "" {
		triggeredBy = &userID
	}
	run, err := s.Runs.Create(r.Context(), uuid.New().String(), req.TestID, triggerType, triggeredBy)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create run")
		return
	}
	s.writeAudit(r, "create", "run", run.ID)
	writeJSON(w, http.StatusCreated, run)
}

func (s *Server) getRunHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) {
		return
	}
	id := chi.URLParam(r, "id")
	run, err := s.Runs.Get(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get run")
		return
	}
	if run == nil {
		writeError(w, http.StatusNotFound, "run not found")
		return
	}
	writeJSON(w, http.StatusOK, run)
}

func (s *Server) stopRunHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) {
		return
	}
	id := chi.URLParam(r, "id")
	run, err := s.Runs.Get(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to stop run")
		return
	}
	if run == nil {
		writeError(w, http.StatusNotFound, "run not found")
		return
	}
	if !strings.EqualFold(run.Status, "RUNNING") {
		writeError(w, http.StatusConflict, "run is not running")
		return
	}
	if s.Runner != nil {
		if err := s.Runner.Stop(r.Context(), id, "STOPPED"); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to stop run")
			return
		}
	} else if err := s.Runs.Stop(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to stop run")
		return
	}
	_ = s.Tests.UpdateStatus(r.Context(), run.TestID, "STOPPED")
	s.writeAudit(r, "stop", "run", id)
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (s *Server) getRunMetricsHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) {
		return
	}
	id := chi.URLParam(r, "id")
	metrics, err := s.Runs.GetMetrics(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get metrics")
		return
	}
	writeJSON(w, http.StatusOK, metrics)
}

// getLiveMetricHandler returns the latest in-memory snapshot for an active run.
func (s *Server) getLiveMetricHandler(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if s.Runner == nil {
		writeError(w, http.StatusServiceUnavailable, "runner not available")
		return
	}
	snap, ok := s.Runner.LiveSnapshot(id)
	if !ok {
		// Fall back to last persisted metric
		if s.Runs != nil {
			metrics, err := s.Runs.GetMetrics(r.Context(), id)
			if err == nil && len(metrics) > 0 {
				last := metrics[len(metrics)-1]
				writeJSON(w, http.StatusOK, map[string]interface{}{
					"runId":           id,
					"duration":        last.Duration,
					"throughput":      last.Throughput,
					"avgResponseTime": last.AvgResponseTime,
					"errorRate":       last.ErrorRate,
					"activeVUsers":    last.ActiveVUsers,
					"source":          "persisted",
				})
				return
			}
		}
		writeError(w, http.StatusNotFound, "no live metrics for run")
		return
	}
	info, _ := s.Runner.RunInfo(id)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"runId":           id,
		"testId":          info.testID,
		"engine":          info.engineName,
		"duration":        snap.Duration,
		"throughput":      snap.Throughput,
		"avgResponseTime": snap.AvgResponseTime,
		"errorRate":       snap.ErrorRate,
		"activeVUsers":    snap.ActiveVUsers,
		"p50":             snap.P50,
		"p90":             snap.P90,
		"p95":             snap.P95,
		"p99":             snap.P99,
		"source":          "live",
	})
}

// listLiveMetricsHandler returns snapshots for all active runs (dashboard poll).
func (s *Server) listLiveMetricsHandler(w http.ResponseWriter, r *http.Request) {
	if s.Runner == nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{"metrics": []interface{}{}, "active": 0})
		return
	}
	ids := s.Runner.ActiveRunIDs()
	out := make([]map[string]interface{}, 0, len(ids))
	for _, id := range ids {
		snap, ok := s.Runner.LiveSnapshot(id)
		if !ok {
			continue
		}
		info, _ := s.Runner.RunInfo(id)
		out = append(out, map[string]interface{}{
			"runId":           id,
			"testId":          info.testID,
			"engine":          info.engineName,
			"duration":        snap.Duration,
			"throughput":      snap.Throughput,
			"avgResponseTime": snap.AvgResponseTime,
			"errorRate":       snap.ErrorRate,
			"activeVUsers":    snap.ActiveVUsers,
			"p50":             snap.P50,
			"p90":             snap.P90,
			"p95":             snap.P95,
			"p99":             snap.P99,
		})
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"metrics": out,
		"active":  len(out),
	})
}

func (s *Server) executionStatusHandler(w http.ResponseWriter, r *http.Request) {
	engines := []string{}
	mode := "unknown"
	k8sOK := false
	active := 0
	if s.Runner != nil {
		engines = s.Runner.Engines()
		mode = s.Runner.Mode()
		k8sOK = s.Runner.HasK8s()
		active = len(s.Runner.ActiveRunIDs())
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"mode":    mode,
		"engines": engines,
		"k8s":     k8sOK,
		"active":  active,
	})
}

func (s *Server) listAuditLogsHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireDB(w) {
		return
	}
	logs, err := s.Audit.List(r.Context(), 100)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list audit logs")
		return
	}
	writeJSON(w, http.StatusOK, logs)
}
