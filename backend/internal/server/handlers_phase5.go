package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"github.com/belo/speedrunner/backend/internal/ai"
	"github.com/belo/speedrunner/backend/internal/chatops"
	"github.com/belo/speedrunner/backend/internal/enterprise"
	"github.com/belo/speedrunner/backend/internal/policy"
)

// chatopsBridge implements chatops.Executor against the control plane.
type chatopsBridge struct{ s *Server }

func (b *chatopsBridge) StartTest(ctx context.Context, testID, user string) (string, error) {
	if b.s.Tests == nil || b.s.Runs == nil || b.s.Runner == nil {
		return "", fmt.Errorf("control plane not ready")
	}
	test, err := b.s.Tests.Get(ctx, testID)
	if err != nil || test == nil {
		return "", fmt.Errorf("test not found")
	}
	if strings.EqualFold(test.Status, "RUNNING") {
		return "", fmt.Errorf("test already running")
	}
	run, err := b.s.Runs.Create(ctx, uuid.New().String(), testID, "CHATOPS", &user)
	if err != nil {
		return "", err
	}
	_ = b.s.Tests.UpdateStatus(ctx, testID, "RUNNING")
	if err := b.s.Runner.Start(ctx, run.ID, test); err != nil {
		return "", err
	}
	return run.ID, nil
}

func (b *chatopsBridge) StopRun(ctx context.Context, runID, user string) error {
	if b.s.Runner == nil {
		return fmt.Errorf("runner not ready")
	}
	return b.s.Runner.Stop(ctx, runID, "STOPPED")
}

func (b *chatopsBridge) GetStatus(ctx context.Context, runID string) (string, error) {
	if b.s.Runs != nil {
		run, err := b.s.Runs.Get(ctx, runID)
		if err == nil && run != nil {
			return run.Status, nil
		}
	}
	if b.s.Runner != nil {
		if _, ok := b.s.Runner.LiveSnapshot(runID); ok {
			return "RUNNING", nil
		}
	}
	return "UNKNOWN", nil
}

// ── 4.11 ChatOps ────────────────────────────────────────────────────────────

type chatopsRequest struct {
	Channel string `json:"channel"`
	User    string `json:"user"`
	Text    string `json:"text"`
}

func (s *Server) chatopsHandler(w http.ResponseWriter, r *http.Request) {
	if s.ChatOps == nil {
		s.ChatOps = chatops.New(&chatopsBridge{s: s})
	}
	var req chatopsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	ch := chatops.ChannelSlack
	if strings.EqualFold(req.Channel, "teams") {
		ch = chatops.ChannelTeams
	}
	cmd, err := chatops.ParseCommand(ch, req.User, req.Text)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	reply, err := s.ChatOps.Handle(r.Context(), cmd)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	s.writeAudit(r, "chatops", "command", cmd.Action)
	writeJSON(w, http.StatusOK, map[string]interface{}{"reply": reply, "action": cmd.Action})
}

// ── 4.12 Policy evaluate ────────────────────────────────────────────────────

type policyEvalRequest struct {
	TargetURL    string `json:"targetUrl"`
	VirtualUsers int    `json:"virtualUsers"`
	Engine       string `json:"engine"`
	Environment  string `json:"environment"`
	UserRole     string `json:"userRole"`
}

func (s *Server) policyEvaluateHandler(w http.ResponseWriter, r *http.Request) {
	var req policyEvalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	maxVUs := 10000
	if s.Config != nil {
		maxVUs = s.Config.Engine.MaxVUs
	}
	if s.Policy == nil {
		s.Policy = policy.DefaultEnterpriseEngine(maxVUs)
	}
	role, _ := r.Context().Value(UserRoleKey).(string)
	if req.UserRole == "" {
		req.UserRole = role
	}
	result, err := s.Policy.Evaluate(r.Context(), policy.ExecutionRequest{
		TargetURL:    req.TargetURL,
		VirtualUsers: req.VirtualUsers,
		Engine:       req.Engine,
		Environment:  req.Environment,
		UserRole:     req.UserRole,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, result)
}

// ── AI 5.x ──────────────────────────────────────────────────────────────────

func (s *Server) aiScriptReviewHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ScriptType string `json:"scriptType"`
		Content    string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"findings": ai.ReviewScript(req.ScriptType, req.Content),
	})
}

func (s *Server) aiGenerateScriptHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Engine  string   `json:"engine"`
		BaseURL string   `json:"baseUrl"`
		Paths   []string `json:"paths"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, ai.GenerateStarterScript(req.Engine, req.BaseURL, req.Paths))
}

func (s *Server) aiDataPoolRecommendHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UseCase         string `json:"useCase"`
		EstimatedUsers  int    `json:"estimatedUsers"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, ai.DataPoolRecommendation(req.UseCase, req.EstimatedUsers))
}

func (s *Server) aiSyntheticDataHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Schema  map[string]string `json:"schema"`
		Count   int               `json:"count"`
		MaskPII bool              `json:"maskPii"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"records": ai.GenerateSyntheticData(req.Schema, req.Count, req.MaskPII),
		"warning": "Synthetic data only — do not use for production PII",
	})
}

func (s *Server) aiRunSummaryHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Audience   string  `json:"audience"`
		Status     string  `json:"status"`
		AvgRT      float64 `json:"avgResponseTime"`
		P95        float64 `json:"p95"`
		Throughput float64 `json:"throughput"`
		ErrorRate  float64 `json:"errorRate"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, ai.RunSummary(req.Audience, req.AvgRT, req.P95, req.Throughput, req.ErrorRate, req.Status))
}

func (s *Server) aiReleaseGateHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AvgRT        float64 `json:"avgResponseTime"`
		BaselineRT   float64 `json:"baselineResponseTime"`
		ErrorRate    float64 `json:"errorRate"`
		Throughput   float64 `json:"throughput"`
		AnomalyCount int     `json:"anomalyCount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, ai.ReleaseGate(req.AvgRT, req.BaselineRT, req.ErrorRate, req.Throughput, req.AnomalyCount))
}

func (s *Server) aiCapacityForecastHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		CurrentVUs  int     `json:"currentVUs"`
		ObservedRPS float64 `json:"observedRps"`
		TargetRPS   float64 `json:"targetRps"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, ai.ForecastCapacity(req.CurrentVUs, req.ObservedRPS, req.TargetRPS))
}

func (s *Server) aiOpsAssistHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Status     string  `json:"status"`
		ErrorRate  float64 `json:"errorRate"`
		AvgRT      float64 `json:"avgResponseTime"`
		LogSnippet string  `json:"logSnippet"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, ai.OperationalAssist(req.Status, req.ErrorRate, req.AvgRT, req.LogSnippet))
}

func (s *Server) aiDefectDraftHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Title    string   `json:"title"`
		Severity string   `json:"severity"`
		Evidence []string `json:"evidence"`
		Owner    string   `json:"owner"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, ai.DefectDraft(req.Title, req.Severity, req.Evidence, req.Owner))
}

// ── Enterprise 6.x ──────────────────────────────────────────────────────────

func (s *Server) readinessHandler(w http.ResponseWriter, r *http.Request) {
	target := r.URL.Query().Get("targetUrl")
	redisOK := s.Redis != nil
	dbOK := s.DB != nil
	k8sOK := s.K8s != nil
	if redisOK {
		if err := s.Redis.Ping(r.Context()); err != nil {
			redisOK = false
		}
	}
	if dbOK {
		if err := s.DB.Pool.Ping(r.Context()); err != nil {
			dbOK = false
		}
	}
	checks := enterprise.CheckEnvironmentReadiness(target, redisOK, dbOK, k8sOK)
	allOK := true
	for _, c := range checks {
		if !c.OK && c.Name == "database" {
			allOK = false
		}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"ready": allOK, "checks": checks})
}

func (s *Server) listVirtualServicesHandler(w http.ResponseWriter, r *http.Request) {
	if s.Virtual == nil {
		s.Virtual = enterprise.NewVirtualRegistry()
	}
	writeJSON(w, http.StatusOK, s.Virtual.List())
}

func (s *Server) createVirtualServiceHandler(w http.ResponseWriter, r *http.Request) {
	if s.Virtual == nil {
		s.Virtual = enterprise.NewVirtualRegistry()
	}
	var v enterprise.VirtualService
	if err := json.NewDecoder(r.Body).Decode(&v); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if v.ID == "" {
		v.ID = uuid.New().String()
	}
	s.Virtual.Register(&v)
	writeJSON(w, http.StatusCreated, v)
}

func (s *Server) listBaselinesHandler(w http.ResponseWriter, r *http.Request) {
	if s.Baselines == nil {
		s.Baselines = enterprise.NewBaselineStore()
	}
	writeJSON(w, http.StatusOK, s.Baselines.List())
}

func (s *Server) proposeBaselineHandler(w http.ResponseWriter, r *http.Request) {
	if s.Baselines == nil {
		s.Baselines = enterprise.NewBaselineStore()
	}
	var b enterprise.Baseline
	if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if b.ID == "" {
		b.ID = uuid.New().String()
	}
	s.Baselines.Propose(&b)
	writeJSON(w, http.StatusCreated, b)
}

func (s *Server) approveBaselineHandler(w http.ResponseWriter, r *http.Request) {
	if s.Baselines == nil {
		writeError(w, http.StatusNotFound, "no baselines")
		return
	}
	id := r.URL.Query().Get("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "id required")
		return
	}
	by := userIDFromContext(r.Context())
	if err := s.Baselines.Approve(id, by); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (s *Server) goldenTemplatesHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, enterprise.GoldenTemplates())
}

func (s *Server) impactAnalysisHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ChangedServices []string `json:"changedServices"`
		ChangedAPIs     []string `json:"changedApis"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	catalog := []string{}
	if s.Tests != nil {
		tests, _ := s.Tests.List(r.Context(), "")
		for _, t := range tests {
			catalog = append(catalog, t.Name)
		}
	}
	writeJSON(w, http.StatusOK, enterprise.ImpactAnalysis(req.ChangedServices, req.ChangedAPIs, catalog))
}

func (s *Server) chaosCatalogHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, enterprise.ChaosCatalog())
}

func (s *Server) residencyCheckHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Region           string `json:"region"`
		RunRegion        string `json:"runRegion"`
		ResultRegion     string `json:"resultRegion"`
		BlockCrossRegion bool   `json:"blockCrossRegion"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	ok, msg := enterprise.EnforceResidency(enterprise.ResidencyPolicy{
		Region: req.Region, BlockCrossRegion: req.BlockCrossRegion,
	}, req.RunRegion, req.ResultRegion)
	writeJSON(w, http.StatusOK, map[string]interface{}{"allowed": ok, "detail": msg})
}

func (s *Server) listQuotasHandler(w http.ResponseWriter, r *http.Request) {
	if s.Quotas == nil {
		s.Quotas = enterprise.NewQuotaStore()
	}
	writeJSON(w, http.StatusOK, s.Quotas.List())
}

func (s *Server) checkQuotaHandler(w http.ResponseWriter, r *http.Request) {
	if s.Quotas == nil {
		s.Quotas = enterprise.NewQuotaStore()
	}
	var req struct {
		Team  string  `json:"team"`
		VUs   int     `json:"virtualUsers"`
		Hours float64 `json:"hours"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	ok, msg := s.Quotas.Check(req.Team, req.VUs, req.Hours)
	writeJSON(w, http.StatusOK, map[string]interface{}{"allowed": ok, "detail": msg})
}

func (s *Server) cleanupPlanHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, enterprise.BuildCleanupPlan(24))
}

func (s *Server) envDriftHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Live    enterprise.EnvSnapshot `json:"live"`
		Desired enterprise.EnvSnapshot `json:"desired"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, enterprise.DetectEnvDrift(req.Live, req.Desired))
}

func (s *Server) contractValidateHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		BaseURL string   `json:"baseUrl"`
		Paths   []string `json:"paths"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, enterprise.ValidateAPIContract(req.BaseURL, req.Paths))
}
