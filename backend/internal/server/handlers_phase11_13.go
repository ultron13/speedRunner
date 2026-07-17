package server

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/belo/speedrunner/backend/internal/platform"
)

func (s *Server) ensurePhase11_13() {
	if s.Tenants == nil {
		s.Tenants = platform.NewTenantStore()
	}
	if s.Marketplace == nil {
		s.Marketplace = platform.NewMarketplace()
	}
	if s.SCIM == nil {
		s.SCIM = platform.NewSCIMStore()
	}
	if s.Meter == nil {
		s.Meter = platform.NewMeterStore()
	}
	if s.ChaosRuns == nil {
		s.ChaosRuns = platform.NewChaosStore()
	}
	if s.Connectors == nil {
		s.Connectors = platform.NewConnectorHub()
	}
	if s.Deliveries == nil {
		s.Deliveries = platform.NewDeliveryLedger()
	}
}

// ── Phase 11 ────────────────────────────────────────────────────────────────

func (s *Server) tenantsHandler(w http.ResponseWriter, r *http.Request) {
	s.ensurePhase11_13()
	if r.Method == http.MethodPost {
		var t platform.Tenant
		if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
			writeError(w, http.StatusBadRequest, "invalid body")
			return
		}
		if t.ID == "" {
			t.ID = uuid.New().String()
		}
		if err := s.Tenants.Upsert(&t); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, t)
		return
	}
	writeJSON(w, http.StatusOK, s.Tenants.List())
}

func (s *Server) licenseValidateHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		License       platform.License `json:"license"`
		RequestedVUs  int              `json:"requestedVUs"`
		Concurrent    int              `json:"concurrentRuns"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, platform.ValidateLicense(body.License, time.Now(), body.RequestedVUs, body.Concurrent))
}

func (s *Server) marketplaceHandler(w http.ResponseWriter, r *http.Request) {
	s.ensurePhase11_13()
	if r.Method == http.MethodPost {
		var body struct {
			Action string                   `json:"action"` // install|publish
			ID     string                   `json:"id"`
			Item   *platform.MarketplaceItem `json:"item"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeError(w, http.StatusBadRequest, "invalid body")
			return
		}
		if body.Action == "install" {
			it, err := s.Marketplace.Install(body.ID)
			if err != nil {
				writeError(w, http.StatusNotFound, err.Error())
				return
			}
			writeJSON(w, http.StatusOK, it)
			return
		}
		if body.Item != nil {
			if body.Item.ID == "" {
				body.Item.ID = uuid.New().String()
			}
			if err := s.Marketplace.Publish(body.Item); err != nil {
				writeError(w, http.StatusBadRequest, err.Error())
				return
			}
			writeJSON(w, http.StatusCreated, body.Item)
			return
		}
		writeError(w, http.StatusBadRequest, "install id or publish item required")
		return
	}
	q := r.URL.Query()
	writeJSON(w, http.StatusOK, s.Marketplace.List(q.Get("kind"), q.Get("tag")))
}

func (s *Server) apiTiersHandler(w http.ResponseWriter, r *http.Request) {
	plan := r.URL.Query().Get("plan")
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"tiers":       platform.DefaultAPITiers(),
		"planTier":    platform.APITierForPlan(plan),
		"scopeExample": platform.ScopeAllows([]string{"test:*", "run:read"}, "test:write"),
	})
}

func (s *Server) ssoConfigHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		var c platform.SSOConfig
		if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
			writeError(w, http.StatusBadRequest, "invalid body")
			return
		}
		ok, issues := platform.ValidateSSOConfig(c)
		writeJSON(w, http.StatusOK, map[string]interface{}{"ok": ok, "issues": issues, "config": c})
		return
	}
	writeJSON(w, http.StatusOK, platform.SSOConfig{
		Provider: "oidc", Scopes: []string{"openid", "profile", "email"}, SCIMEnabled: true,
	})
}

func (s *Server) scimUsersHandler(w http.ResponseWriter, r *http.Request) {
	s.ensurePhase11_13()
	if r.Method == http.MethodPost {
		var u platform.SCIMUser
		if err := json.NewDecoder(r.Body).Decode(&u); err != nil {
			writeError(w, http.StatusBadRequest, "invalid body")
			return
		}
		if u.ID == "" {
			u.ID = uuid.New().String()
		}
		s.SCIM.Upsert(&u)
		writeJSON(w, http.StatusCreated, u)
		return
	}
	writeJSON(w, http.StatusOK, s.SCIM.List())
}

func (s *Server) usageMeterHandler(w http.ResponseWriter, r *http.Request) {
	s.ensurePhase11_13()
	if r.Method == http.MethodPost {
		var e platform.UsageEvent
		if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
			writeError(w, http.StatusBadRequest, "invalid body")
			return
		}
		s.Meter.Record(e)
		writeJSON(w, http.StatusCreated, e)
		return
	}
	tenant := r.URL.Query().Get("tenantId")
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"tenantId": tenant,
		"usage":    s.Meter.Aggregate(tenant),
	})
}

// ── Phase 12 ────────────────────────────────────────────────────────────────

func (s *Server) qualityGateHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Rules   []platform.QualityGateRule `json:"rules"`
		Metrics map[string]float64         `json:"metrics"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if len(body.Rules) == 0 {
		body.Rules = platform.DefaultReleaseGate()
	}
	writeJSON(w, http.StatusOK, platform.EvaluateQualityGate(body.Rules, body.Metrics))
}

func (s *Server) digitalTwinHandler(w http.ResponseWriter, r *http.Request) {
	var in platform.DigitalTwinInput
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, platform.SimulateDigitalTwin(in))
}

func (s *Server) chaosAdvancedHandler(w http.ResponseWriter, r *http.Request) {
	s.ensurePhase11_13()
	if r.Method == http.MethodPost {
		var body struct {
			ScenarioID string `json:"scenarioId"`
			Env        string `json:"env"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeError(w, http.StatusBadRequest, "invalid body")
			return
		}
		var sc *platform.ChaosScenario
		for _, c := range platform.ChaosCatalog() {
			if c.ID == body.ScenarioID {
				cc := c
				sc = &cc
				break
			}
		}
		if sc == nil {
			writeError(w, http.StatusNotFound, "scenario not found")
			return
		}
		ok, reason := platform.ValidateChaos(*sc, body.Env)
		if !ok {
			writeError(w, http.StatusForbidden, reason)
			return
		}
		run := s.ChaosRuns.Start(platform.ChaosRun{
			ID: uuid.New().String(), Scenario: sc.ID, Env: body.Env,
		})
		writeJSON(w, http.StatusCreated, run)
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"catalog": platform.ChaosCatalog(),
		"runs":    s.ChaosRuns.List(),
	})
}

func (s *Server) browserJourneyHandler(w http.ResponseWriter, r *http.Request) {
	var j platform.AdvancedBrowserJourney
	if err := json.NewDecoder(r.Body).Decode(&j); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	ok, issues := platform.ValidateJourney(j)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ok":                  ok,
		"issues":              issues,
		"estimatedDurationMs": platform.JourneyDurationEstimate(j),
		"journey":             j,
	})
}

func (s *Server) perfBudgetHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Budget       platform.PerfBudget `json:"budget"`
		ActualP95    float64             `json:"actualP95"`
		ActualError  float64             `json:"actualErrorRate"`
		ActualBundle float64             `json:"actualBundleKb"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, platform.CheckPerfBudget(body.Budget, body.ActualP95, body.ActualError, body.ActualBundle))
}

// ── Phase 13 ────────────────────────────────────────────────────────────────

func (s *Server) edgeLocationsHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"edges":   platform.DefaultEdgeLocations(),
		"mobile":  platform.MobileProfiles(),
	})
}

func (s *Server) mobileNetworkHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		BaseP95 float64               `json:"baseP95"`
		Profile platform.MobileProfile `json:"profile"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"adjustedP95": platform.ApplyMobileNetwork(body.BaseP95, body.Profile),
		"profile":     body.Profile,
	})
}

func (s *Server) finopsHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		VUs         int     `json:"vus"`
		DurationSec int     `json:"durationSec"`
		Region      string  `json:"region"`
		NetworkGB   float64 `json:"networkGb"`
		StorageGB   float64 `json:"storageGb"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	est := platform.EstimateFinOps(body.VUs, body.DurationSec, body.Region, body.NetworkGB, body.StorageGB)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"estimate": est,
		"grade":    platform.CarbonGrade(est.CarbonKgCO2e),
		"report":   platform.SustainabilityReport([]platform.FinOpsEstimate{est}),
	})
}

func (s *Server) connectorsHandler(w http.ResponseWriter, r *http.Request) {
	s.ensurePhase11_13()
	if r.Method == http.MethodPost {
		var body struct {
			Action string            `json:"action"` // connect|disconnect
			ID     string            `json:"id"`
			Config map[string]string `json:"config"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeError(w, http.StatusBadRequest, "invalid body")
			return
		}
		if body.Action == "disconnect" {
			if err := s.Connectors.Disconnect(body.ID); err != nil {
				writeError(w, http.StatusNotFound, err.Error())
				return
			}
			writeJSON(w, http.StatusOK, map[string]string{"status": "disconnected", "id": body.ID})
			return
		}
		c, err := s.Connectors.Connect(body.ID, body.Config)
		if err != nil {
			writeError(w, http.StatusNotFound, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, c)
		return
	}
	writeJSON(w, http.StatusOK, s.Connectors.List(r.URL.Query().Get("category")))
}

func (s *Server) deliveryLedgerHandler(w http.ResponseWriter, r *http.Request) {
	s.ensurePhase11_13()
	if r.Method == http.MethodPost {
		var a platform.DeliveryAttempt
		if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
			writeError(w, http.StatusBadRequest, "invalid body")
			return
		}
		if a.ID == "" {
			a.ID = uuid.New().String()
		}
		s.Deliveries.Record(a)
		writeJSON(w, http.StatusCreated, map[string]interface{}{
			"attempt":    a,
			"shouldRetry": platform.ShouldRetryDelivery(a.StatusCode, a.Attempts, 5),
		})
		return
	}
	writeJSON(w, http.StatusOK, s.Deliveries.Recent(50))
}

func (s *Server) platformPhases11Handler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{"wave": "11", "count": 50, "phases": platform.Phase11Catalog()})
}
func (s *Server) platformPhases12Handler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{"wave": "12", "count": 50, "phases": platform.Phase12Catalog()})
}
func (s *Server) platformPhases13Handler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{"wave": "13", "count": 50, "phases": platform.Phase13Catalog()})
}
