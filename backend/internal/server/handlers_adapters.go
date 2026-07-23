package server

import (
	"encoding/json"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/belo/speedrunner/backend/internal/auth"
	"github.com/belo/speedrunner/backend/internal/db/queries"
	"github.com/belo/speedrunner/backend/internal/integrations/jira"
	"github.com/belo/speedrunner/backend/internal/scim"
)

// ── OIDC ────────────────────────────────────────────────────────────────────

func (s *Server) oidcStatusHandler(w http.ResponseWriter, r *http.Request) {
	if s.OIDC == nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{"enabled": false})
		return
	}
	writeJSON(w, http.StatusOK, s.OIDC.Status(r.Context()))
}

func (s *Server) oidcLoginHandler(w http.ResponseWriter, r *http.Request) {
	if s.OIDC == nil || !s.OIDC.Enabled() {
		writeError(w, http.StatusServiceUnavailable, "OIDC not configured")
		return
	}
	// Demo shortcut: ?demo=1 exchanges without redirect (for UI testing)
	if r.URL.Query().Get("demo") == "1" || s.OIDC.Config().DemoMode {
		s.completeOIDCLogin(w, r, "demo-code", "")
		return
	}
	authURL, state, err := s.OIDC.BeginLogin(r.Context())
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	// JSON for SPA clients; optional redirect
	if r.URL.Query().Get("redirect") == "1" {
		http.Redirect(w, r, authURL, http.StatusFound)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"authorizationUrl": authURL,
		"state":            state,
	})
}

func (s *Server) oidcCallbackHandler(w http.ResponseWriter, r *http.Request) {
	if s.OIDC == nil || !s.OIDC.Enabled() {
		writeError(w, http.StatusServiceUnavailable, "OIDC not configured")
		return
	}
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")
	if errParam := r.URL.Query().Get("error"); errParam != "" {
		writeError(w, http.StatusBadRequest, errParam+": "+r.URL.Query().Get("error_description"))
		return
	}
	if code == "" {
		writeError(w, http.StatusBadRequest, "missing code")
		return
	}
	s.completeOIDCLogin(w, r, code, state)
}

func (s *Server) completeOIDCLogin(w http.ResponseWriter, r *http.Request, code, state string) {
	ts, err := s.OIDC.ExchangeCode(r.Context(), code, state)
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}
	info, err := s.OIDC.FetchUserInfo(r.Context(), ts.AccessToken)
	if err != nil {
		// fall back to demo identity
		info = &auth.UserInfo{Sub: "oidc-user", Email: "oidc.user@speedrunner.local", Name: "OIDC User"}
	}
	email := strings.TrimSpace(strings.ToLower(info.Email))
	if email == "" {
		email = strings.ToLower(info.Sub) + "@oidc.local"
	}
	name := info.Name
	if name == "" {
		name = email
	}

	userID := uuid.New().String()
	role := string(auth.RoleReadOnly)
	if s.Users != nil {
		// Durable OIDC provision (create or update DB user)
		u, err := s.Users.UpsertOIDC(r.Context(), userID, email, name, role)
		if err == nil && u != nil {
			userID = u.ID
			role = u.Role
		}
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  userID,
		"role": role,
		"amr":  "oidc",
		"exp":  time.Now().Add(time.Duration(s.Config.JWT.ExpireHour) * time.Hour).Unix(),
	})
	tokenStr, err := token.SignedString([]byte(s.Config.JWT.Secret))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "token issue failed")
		return
	}
	s.writeAudit(r, "oidc_login", "user", userID)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"token": tokenStr,
		"user": map[string]interface{}{
			"id": userID, "email": email, "name": name, "role": role,
		},
		"oidc": map[string]interface{}{
			"sub": info.Sub, "expiresIn": ts.ExpiresIn,
		},
	})
}

// ── SCIM 2.0 ────────────────────────────────────────────────────────────────

func (s *Server) scimAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Accept: Bearer <JWT> with admin, or Bearer <SCIM_TOKEN>
		h := r.Header.Get("Authorization")
		if h == "" {
			writeSCIMError(w, http.StatusUnauthorized, "missing authorization")
			return
		}
		parts := strings.SplitN(h, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
			writeSCIMError(w, http.StatusUnauthorized, "invalid authorization")
			return
		}
		token := parts[1]
		scimTok := os.Getenv("SCIM_TOKEN")
		if scimTok != "" && token == scimTok {
			next.ServeHTTP(w, r)
			return
		}
		// JWT path
		parsed, err := jwt.Parse(token, func(t *jwt.Token) (any, error) {
			return []byte(s.Config.JWT.Secret), nil
		})
		if err != nil || !parsed.Valid {
			writeSCIMError(w, http.StatusUnauthorized, "invalid token")
			return
		}
		claims, _ := parsed.Claims.(jwt.MapClaims)
		role, _ := claims["role"].(string)
		if !auth.HasPermission(auth.Role(role), "admin:write") && !auth.HasPermission(auth.Role(role), "admin:read") {
			// allow read for admin:read, write needs admin:write checked per method
			if r.Method != http.MethodGet {
				writeSCIMError(w, http.StatusForbidden, "insufficient permissions")
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func writeSCIMError(w http.ResponseWriter, status int, detail string) {
	w.Header().Set("Content-Type", "application/scim+json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(scim.NewError(status, detail))
}

func writeSCIM(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/scim+json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func (s *Server) scimServiceProviderConfig(w http.ResponseWriter, r *http.Request) {
	writeSCIM(w, http.StatusOK, scim.DefaultServiceProviderConfig())
}

func (s *Server) scimListUsers(w http.ResponseWriter, r *http.Request) {
	if s.SCIMUsers == nil {
		s.SCIMUsers = scim.NewStore("/api/scim/v2")
	}
	start, _ := strconv.Atoi(r.URL.Query().Get("startIndex"))
	count, _ := strconv.Atoi(r.URL.Query().Get("count"))
	filter := r.URL.Query().Get("filter")
	if s.Users != nil {
		users, err := s.Users.List(r.Context(), 200)
		if err == nil {
			resources := make([]*scim.User, 0, len(users))
			for i := range users {
				resources = append(resources, dbUserToSCIM(&users[i]))
			}
			if filter != "" {
				filtered := make([]*scim.User, 0)
				for _, ru := range resources {
					if strings.Contains(strings.ToLower(ru.UserName), strings.ToLower(filter)) ||
						strings.Contains(strings.ToLower(ru.DisplayName), strings.ToLower(filter)) {
						filtered = append(filtered, ru)
					}
				}
				resources = filtered
			}
			if start < 1 {
				start = 1
			}
			if count <= 0 {
				count = 100
			}
			from := start - 1
			if from > len(resources) {
				from = len(resources)
			}
			to := from + count
			if to > len(resources) {
				to = len(resources)
			}
			page := resources[from:to]
			writeSCIM(w, http.StatusOK, scim.ListResponse{
				Schemas: []string{scim.SchemaListResp}, TotalResults: len(resources),
				StartIndex: start, ItemsPerPage: len(page), Resources: page,
			})
			return
		}
	}
	writeSCIM(w, http.StatusOK, s.SCIMUsers.List(filter, start, count))
}

func dbUserToSCIM(u *queries.User) *scim.User {
	return &scim.User{
		Schemas:     []string{scim.SchemaUser},
		ID:          u.ID,
		ExternalID:  u.SCIMExternalID,
		UserName:    u.Email,
		DisplayName: u.Name,
		Active:      u.Active,
		Emails:      []scim.Email{{Value: u.Email, Primary: true, Type: "work"}},
		Name:        &scim.Name{Formatted: u.Name},
		Roles:       []map[string]string{{"value": u.Role, "display": u.Role}},
		Meta: scim.Meta{
			ResourceType: "User",
			Created:      u.CreatedAt.UTC().Format(time.RFC3339),
			LastModified: u.UpdatedAt.UTC().Format(time.RFC3339),
			Location:     "/api/scim/v2/Users/" + u.ID,
		},
	}
}

func (s *Server) scimGetUser(w http.ResponseWriter, r *http.Request) {
	if s.SCIMUsers == nil {
		s.SCIMUsers = scim.NewStore("/api/scim/v2")
	}
	id := chi.URLParam(r, "id")
	if s.Users != nil {
		if u, err := s.Users.GetByID(r.Context(), id); err == nil && u != nil {
			writeSCIM(w, http.StatusOK, dbUserToSCIM(u))
			return
		}
	}
	u, ok := s.SCIMUsers.Get(id)
	if !ok {
		writeSCIMError(w, http.StatusNotFound, "User not found")
		return
	}
	writeSCIM(w, http.StatusOK, u)
}

func (s *Server) scimCreateUser(w http.ResponseWriter, r *http.Request) {
	if s.SCIMUsers == nil {
		s.SCIMUsers = scim.NewStore("/api/scim/v2")
	}
	var u scim.User
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		writeSCIMError(w, http.StatusBadRequest, "invalid body")
		return
	}
	created := s.SCIMUsers.Create(&u)
	if s.Users != nil {
		email := strings.ToLower(created.UserName)
		if len(created.Emails) > 0 {
			email = strings.ToLower(created.Emails[0].Value)
		}
		name := created.DisplayName
		if name == "" {
			name = created.UserName
		}
		role := string(auth.RoleReadOnly)
		if len(created.Roles) > 0 {
			if v := created.Roles[0]["value"]; v != "" {
				role = v
			}
		}
		if dbU, err := s.Users.UpsertSCIM(r.Context(), created.ID, email, name, role, created.ExternalID, created.Active); err == nil && dbU != nil {
			writeSCIM(w, http.StatusCreated, dbUserToSCIM(dbU))
			return
		}
	}
	writeSCIM(w, http.StatusCreated, created)
}

func (s *Server) scimReplaceUser(w http.ResponseWriter, r *http.Request) {
	if s.SCIMUsers == nil {
		s.SCIMUsers = scim.NewStore("/scim/v2")
	}
	id := chi.URLParam(r, "id")
	var u scim.User
	if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
		writeSCIMError(w, http.StatusBadRequest, "invalid body")
		return
	}
	out, err := s.SCIMUsers.Replace(id, &u)
	if err != nil {
		writeSCIMError(w, http.StatusNotFound, "User not found")
		return
	}
	writeSCIM(w, http.StatusOK, out)
}

func (s *Server) scimPatchUser(w http.ResponseWriter, r *http.Request) {
	if s.SCIMUsers == nil {
		s.SCIMUsers = scim.NewStore("/api/scim/v2")
	}
	id := chi.URLParam(r, "id")
	var patch scim.PatchOp
	if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
		writeSCIMError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if s.Users != nil {
		for _, op := range patch.Operations {
			path, _ := op["path"].(string)
			if strings.EqualFold(path, "active") {
				if v, ok := op["value"].(bool); ok {
					_ = s.Users.SetActive(r.Context(), id, v)
				}
			}
		}
		if u, err := s.Users.GetByID(r.Context(), id); err == nil && u != nil {
			writeSCIM(w, http.StatusOK, dbUserToSCIM(u))
			return
		}
	}
	out, err := s.SCIMUsers.Patch(id, patch.Operations)
	if err != nil {
		writeSCIMError(w, http.StatusNotFound, "User not found")
		return
	}
	writeSCIM(w, http.StatusOK, out)
}

func (s *Server) scimDeleteUser(w http.ResponseWriter, r *http.Request) {
	if s.SCIMUsers == nil {
		s.SCIMUsers = scim.NewStore("/scim/v2")
	}
	id := chi.URLParam(r, "id")
	if !s.SCIMUsers.Delete(id) {
		writeSCIMError(w, http.StatusNotFound, "User not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── Jira ────────────────────────────────────────────────────────────────────

func (s *Server) jiraStatusHandler(w http.ResponseWriter, r *http.Request) {
	if s.Jira == nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{"configured": false, "demoMode": true})
		return
	}
	writeJSON(w, http.StatusOK, s.Jira.Status())
}

func (s *Server) jiraCreateIssueHandler(w http.ResponseWriter, r *http.Request) {
	if s.Jira == nil {
		s.Jira = jira.New(jira.Config{DemoMode: true})
	}
	var req jira.IssueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	issue, err := s.Jira.CreateIssue(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	s.writeAudit(r, "jira_create_issue", "jira", issue.Key)
	writeJSON(w, http.StatusCreated, issue)
}

func (s *Server) jiraGetIssueHandler(w http.ResponseWriter, r *http.Request) {
	if s.Jira == nil {
		s.Jira = jira.New(jira.Config{DemoMode: true})
	}
	key := chi.URLParam(r, "key")
	issue, err := s.Jira.GetIssue(r.Context(), key)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, issue)
}

func (s *Server) jiraSearchHandler(w http.ResponseWriter, r *http.Request) {
	if s.Jira == nil {
		s.Jira = jira.New(jira.Config{DemoMode: true})
	}
	var body struct {
		JQL        string `json:"jql"`
		MaxResults int    `json:"maxResults"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if body.JQL == "" {
		body.JQL = r.URL.Query().Get("jql")
	}
	res, err := s.Jira.Search(r.Context(), body.JQL, body.MaxResults)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (s *Server) jiraDefectFromRunHandler(w http.ResponseWriter, r *http.Request) {
	if s.Jira == nil {
		s.Jira = jira.New(jira.Config{DemoMode: true})
	}
	var body struct {
		ProjectKey  string  `json:"projectKey"`
		RunID       string  `json:"runId"`
		TestName    string  `json:"testName"`
		ErrorRate   float64 `json:"errorRate"`
		P95         float64 `json:"p95"`
		EvidenceURL string  `json:"evidenceUrl"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if body.ProjectKey == "" {
		body.ProjectKey = "PERF"
	}
	issue, err := s.Jira.CreateDefectFromRun(r.Context(), body.ProjectKey, body.RunID, body.TestName, body.ErrorRate, body.P95, body.EvidenceURL)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	s.writeAudit(r, "jira_defect_from_run", "jira", issue.Key)
	writeJSON(w, http.StatusCreated, issue)
}
