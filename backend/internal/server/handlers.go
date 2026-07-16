package server

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

)

// In-memory user store (will be replaced with DB queries)
type userStore struct {
	users map[string]struct {
		ID           string
		Email        string
		Name         string
		PasswordHash string
		Role         string
	}
}

var store = &userStore{users: make(map[string]struct {
	ID           string
	Email        string
	Name         string
	PasswordHash string
	Role         string
})}

func init() {
	// Seed admin user
	hash, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
	store.users["admin"] = struct {
		ID           string
		Email        string
		Name         string
		PasswordHash string
		Role         string
	}{
		ID:           "admin",
		Email:        "admin@speedrunner.local",
		Name:         "Admin",
		PasswordHash: string(hash),
		Role:         "PLATFORM_ADMIN",
	}
}

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
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
	Role  string `json:"role"`
}

type tokenResponse struct {
	Token string       `json:"token"`
	User  userResponse `json:"user"`
}

type errorResponse struct {
	Error string `json:"error"`
}

func (s *Server) loginHandler(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Find user by email
	var foundUser struct {
		ID           string
		Email        string
		Name         string
		PasswordHash string
		Role         string
	}
	found := false
	for _, u := range store.users {
		if u.Email == req.Email {
			foundUser = u
			found = true
			break
		}
	}
	if !found {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(foundUser.PasswordHash), []byte(req.Password)); err != nil {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  foundUser.ID,
		"role": foundUser.Role,
		"exp":  time.Now().Add(time.Duration(s.Config.JWT.ExpireHour) * time.Hour).Unix(),
	})

	tokenStr, err := token.SignedString([]byte(s.Config.JWT.Secret))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate token")
		return
	}

	writeJSON(w, http.StatusOK, tokenResponse{
		Token: tokenStr,
		User: userResponse{
			ID:    foundUser.ID,
			Email: foundUser.Email,
			Name:  foundUser.Name,
			Role:  foundUser.Role,
		},
	})
}

func (s *Server) registerHandler(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to hash password")
		return
	}

	id := req.Email
	role := req.Role
	if role == "" {
		role = "READ_ONLY"
	}

	store.users[id] = struct {
		ID           string
		Email        string
		Name         string
		PasswordHash string
		Role         string
	}{
		ID:           id,
		Email:        req.Email,
		Name:         req.Name,
		PasswordHash: string(hash),
		Role:         role,
	}

	writeJSON(w, http.StatusCreated, userResponse{
		ID:    id,
		Email: req.Email,
		Name:  req.Name,
		Role:  role,
	})
}

func (s *Server) meHandler(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(UserIDKey).(string)
	if !ok || userID == "" {
		writeError(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	user, found := store.users[userID]
	if !found {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}

	writeJSON(w, http.StatusOK, userResponse{
		ID:    user.ID,
		Email: user.Email,
		Name:  user.Name,
		Role:  user.Role,
	})
}

// Placeholder handlers for API routes
func (s *Server) listProjectsHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, []interface{}{})
}

func (s *Server) createProjectHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusCreated, map[string]string{"message": "project created"})
}

func (s *Server) getProjectHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"id": chi.URLParam(r, "id")})
}

func (s *Server) updateProjectHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"message": "project updated"})
}

func (s *Server) deleteProjectHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"message": "project deleted"})
}

func (s *Server) listTestsHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, []interface{}{})
}

func (s *Server) createTestHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusCreated, map[string]string{"message": "test created"})
}

func (s *Server) getTestHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"id": chi.URLParam(r, "id")})
}

func (s *Server) updateTestHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"message": "test updated"})
}

func (s *Server) deleteTestHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"message": "test deleted"})
}

func (s *Server) startTestHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"message": "test started"})
}

func (s *Server) stopTestHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"message": "test stopped"})
}

func (s *Server) listRunsHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, []interface{}{})
}

func (s *Server) createRunHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusCreated, map[string]string{"message": "run created"})
}

func (s *Server) getRunHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"id": chi.URLParam(r, "id")})
}

func (s *Server) stopRunHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"message": "run stopped"})
}

func (s *Server) getRunMetricsHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, []interface{}{})
}

func (s *Server) listSchedulesHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, []interface{}{})
}

func (s *Server) createScheduleHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusCreated, map[string]string{"message": "schedule created"})
}

func (s *Server) updateScheduleHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"message": "schedule updated"})
}

func (s *Server) deleteScheduleHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"message": "schedule deleted"})
}

func (s *Server) listSLAThresholdsHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, []interface{}{})
}

func (s *Server) createSLAThresholdHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusCreated, map[string]string{"message": "SLA threshold created"})
}

func (s *Server) listSLAResultsHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, []interface{}{})
}

func (s *Server) listTemplatesHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, []interface{}{})
}

func (s *Server) createTemplateHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusCreated, map[string]string{"message": "template created"})
}

func (s *Server) listAuditLogsHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, []interface{}{})
}

// Ensure config import is used
