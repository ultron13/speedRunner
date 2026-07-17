package server

import (
	"encoding/json"
	"net/http"

	"github.com/belo/speedrunner/backend/internal/platform"
)

func (s *Server) ensurePhase21() {
	if s.AssetVersions == nil {
		s.AssetVersions = platform.NewAssetVersionStore()
	}
}

func (s *Server) portfolioHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Projects []platform.PortfolioProject `json:"projects"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if len(body.Projects) == 0 {
		body.Projects = []platform.PortfolioProject{
			{ID: "p1", Name: "Checkout", OpenRisks: 1, SLAPassRate: 92, HealthScore: 85, ActiveTests: 4},
			{ID: "p2", Name: "Identity", OpenRisks: 0, SLAPassRate: 98, HealthScore: 94, ActiveTests: 2},
			{ID: "p3", Name: "Search", OpenRisks: 3, SLAPassRate: 75, HealthScore: 58, ActiveTests: 1},
		}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"projects": body.Projects,
		"summary":  platform.PortfolioSummary(body.Projects),
	})
}

func (s *Server) assetVersionsHandler(w http.ResponseWriter, r *http.Request) {
	s.ensurePhase21()
	if r.Method == http.MethodPost {
		var body struct {
			AssetID string `json:"assetId"`
			Author  string `json:"author"`
			Message string `json:"message"`
			Content string `json:"content"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.AssetID == "" {
			writeError(w, http.StatusBadRequest, "assetId required")
			return
		}
		if body.Author == "" {
			body.Author = userIDFromContext(r.Context())
		}
		writeJSON(w, http.StatusCreated, s.AssetVersions.Commit(body.AssetID, body.Author, body.Message, body.Content))
		return
	}
	assetID := r.URL.Query().Get("assetId")
	writeJSON(w, http.StatusOK, s.AssetVersions.History(assetID))
}

func (s *Server) scriptBranchHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Target platform.ScriptBranch `json:"target"`
		Source platform.ScriptBranch `json:"source"`
		Force  bool                  `json:"force"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	ok, reason := platform.MergeBranchAllowed(body.Target, body.Source, body.Force)
	writeJSON(w, http.StatusOK, map[string]interface{}{"allowed": ok, "reason": reason})
}

func (s *Server) paramWizardHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		URL  string `json:"url"`
		Body string `json:"body"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"parameters": platform.SuggestParameters(body.URL, body.Body),
	})
}

func (s *Server) correlationStudioHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ResponseBody string `json:"responseBody"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"rules": platform.DetectCorrelations(body.ResponseBody),
	})
}

func (s *Server) networkProfilesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		var body struct {
			BaseP95 float64                 `json:"baseP95"`
			Profile platform.NetworkProfile `json:"profile"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeError(w, http.StatusBadRequest, "invalid body")
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"adjustedP95": platform.ApplyWAN(body.BaseP95, body.Profile),
			"profile":     body.Profile,
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"wan":       platform.WANProfiles(),
		"thinkTime": platform.ThinkTimeLibrary(),
	})
}

func (s *Server) autoHealHandler(w http.ResponseWriter, r *http.Request) {
	var h platform.LGHealth
	if err := json.NewDecoder(r.Body).Decode(&h); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, platform.AutoHealAction(h))
}

func (s *Server) aggregateShardsHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Shards []platform.ShardResult `json:"shards"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, platform.AggregateShards(body.Shards))
}

func (s *Server) comparisonMatrixHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Rows []platform.RunMatrixRow `json:"rows"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, platform.ComparisonMatrix(body.Rows))
}

func (s *Server) executivePackHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Title   string   `json:"title"`
		Score   float64  `json:"score"`
		Risks   []string `json:"risks"`
		CostUSD float64  `json:"costUsd"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if body.Title == "" {
		body.Title = "Performance board pack"
	}
	writeJSON(w, http.StatusOK, platform.ExecutiveBoardPack(body.Title, body.Score, body.Risks, body.CostUSD))
}

func (s *Server) slaIncidentHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Service   string  `json:"service"`
		RunID     string  `json:"runId"`
		ErrorRate float64 `json:"errorRate"`
		P95       float64 `json:"p95"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, platform.DraftIncidentFromSLA(body.Service, body.RunID, body.ErrorRate, body.P95))
}

func (s *Server) quotaCheckHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Quota      platform.ResourceQuota `json:"quota"`
		VUs        int                    `json:"vus"`
		Concurrent int                    `json:"concurrent"`
		DailyRuns  int                    `json:"dailyRuns"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, platform.CheckQuota(body.Quota, body.VUs, body.Concurrent, body.DailyRuns))
}

func (s *Server) blueGreenHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Active    platform.EnvSlot `json:"active"`
		Candidate platform.EnvSlot `json:"candidate"`
		Force     bool             `json:"force"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, platform.BlueGreenSwitch(body.Active, body.Candidate, body.Force))
}

func (s *Server) residencyGateHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		AllowedRegions  []string `json:"allowedRegions"`
		RequestedRegion string   `json:"requestedRegion"`
		DataClass       string   `json:"dataClass"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, platform.ResidencyGate(body.AllowedRegions, body.RequestedRegion, body.DataClass))
}

func (s *Server) testingCalendarHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Events []platform.CalendarEvent `json:"events"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"conflicts": platform.CalendarConflicts(body.Events),
		"count":     len(body.Events),
	})
}

func (s *Server) flakyDetectorHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		History []bool `json:"history"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, platform.DetectFlaky(body.History))
}

func (s *Server) regressionBaselineHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Baseline  []float64 `json:"baseline"`
		Current   float64   `json:"current"`
		ZThreshold float64  `json:"zThreshold"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, platform.RegressionAgainstBaseline(body.Baseline, body.Current, body.ZThreshold))
}

func (s *Server) platformSelfHealthHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Components []platform.PlatformComponent `json:"components"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if len(body.Components) == 0 {
		// Live-ish defaults from server deps
		dbOK := s.DB != nil
		redisOK := s.Redis != nil
		body.Components = []platform.PlatformComponent{
			{Name: "api", OK: true, Latency: 5},
			{Name: "database", OK: dbOK, Latency: 12},
			{Name: "redis", OK: redisOK, Latency: 3},
			{Name: "k8s", OK: s.K8s != nil, Latency: 8},
		}
	}
	writeJSON(w, http.StatusOK, platform.PlatformSelfHealth(body.Components))
}

func (s *Server) platformPhases21to41Handler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"wave":   "21-41",
		"count":  21,
		"phases": platform.Phase21to41Catalog(),
	})
}
