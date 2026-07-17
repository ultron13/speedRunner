package platform

import (
	"testing"
	"time"
)

func TestPhase11TenantLicenseMarketplace(t *testing.T) {
	ts := NewTenantStore()
	if err := ts.Upsert(&Tenant{ID: "acme", Name: "Acme", Plan: "team", Region: "eu-west-1"}); err != nil {
		t.Fatal(err)
	}
	if _, ok := ts.Get("acme"); !ok {
		t.Fatal("get")
	}
	if len(ts.List()) < 2 {
		t.Fatal("list")
	}
	if !TenantIsolationOK("a", "a") || TenantIsolationOK("a", "b") {
		t.Fatal("isolation")
	}
	lic := License{
		Key: "k1", TenantID: "acme", MaxVUs: 1000, MaxConcurrent: 5,
		ExpiresAt: time.Now().Add(30 * 24 * time.Hour),
		Features:  []string{"ai", "chaos"},
	}
	v := ValidateLicense(lic, time.Now(), 500, 2)
	if v["valid"] != true {
		t.Fatal(v)
	}
	bad := ValidateLicense(lic, time.Now(), 5000, 2)
	if bad["valid"] != false {
		t.Fatal(bad)
	}
	if !HasFeature(lic, "ai") || HasFeature(lic, "x") {
		t.Fatal("feature")
	}
	mp := NewMarketplace()
	if len(mp.List("script", "")) == 0 {
		t.Fatal("list scripts")
	}
	it, err := mp.Install("m-login")
	if err != nil || it.Downloads < 1 {
		t.Fatal(it, err)
	}
	if err := mp.Publish(&MarketplaceItem{ID: "new", Name: "N", Kind: "plugin"}); err != nil {
		t.Fatal(err)
	}
	tier := APITierForPlan("enterprise")
	if tier.RPM < 1000 {
		t.Fatal(tier)
	}
	if !ScopeAllows([]string{"test:*"}, "test:read") || ScopeAllows([]string{"run:read"}, "test:write") {
		t.Fatal("scopes")
	}
	ok, issues := ValidateSSOConfig(SSOConfig{Provider: "oidc", Issuer: "https://idp", ClientID: "c"})
	if !ok || len(issues) != 0 {
		t.Fatal(issues)
	}
	scim := NewSCIMStore()
	scim.Upsert(&SCIMUser{ID: "1", UserName: "u", Active: true, Email: "u@x.com"})
	if len(scim.List()) != 1 {
		t.Fatal("scim")
	}
	meter := NewMeterStore()
	meter.Record(UsageEvent{TenantID: "acme", Metric: "vu_hours", Quantity: 12})
	agg := meter.Aggregate("acme")
	if agg["vu_hours"] != 12 {
		t.Fatal(agg)
	}
	if len(Phase11Catalog()) != 50 {
		t.Fatal(len(Phase11Catalog()))
	}
}

func TestPhase12GatesTwinChaosJourney(t *testing.T) {
	res := EvaluateQualityGate(DefaultReleaseGate(), map[string]float64{
		"errorRate": 0.5, "p95": 200, "throughput": 50, "slaPass": 1,
	})
	if !res.Passed {
		t.Fatal(res)
	}
	fail := EvaluateQualityGate(DefaultReleaseGate(), map[string]float64{
		"errorRate": 5, "p95": 900, "slaPass": 0,
	})
	if fail.Passed {
		t.Fatal(fail)
	}
	twin := SimulateDigitalTwin(DigitalTwinInput{
		BaselineVUs: 100, BaselineRPS: 200, BaselineP95: 150, TargetVUs: 800, SaturationVUs: 400,
	})
	if twin.Risk == "" || twin.ProjectedP95 <= 0 {
		t.Fatal(twin)
	}
	cat := ChaosCatalog()
	ok, _ := ValidateChaos(cat[0], "dev")
	if !ok {
		t.Fatal("chaos ok")
	}
	unsafe := cat[3] // dns fail safe=false
	if ok, _ := ValidateChaos(unsafe, "prod"); ok {
		t.Fatal("should block prod")
	}
	cs := NewChaosStore()
	cs.Start(ChaosRun{ID: "1", Scenario: "c-pod-kill", Env: "dev"})
	if len(cs.List()) != 1 {
		t.Fatal("runs")
	}
	j := AdvancedBrowserJourney{
		Name: "Checkout", BaseURL: "https://shop.example", Engine: "playwright",
		Steps: []JourneyStep{{Name: "home", Action: "navigate", Value: "/"}, {Name: "buy", Action: "click", Selector: "#buy"}},
	}
	okJ, issues := ValidateJourney(j)
	if !okJ {
		t.Fatal(issues)
	}
	if JourneyDurationEstimate(j) <= 0 {
		t.Fatal("dur")
	}
	b := CheckPerfBudget(PerfBudget{P95Budget: 300, ErrorBudget: 1}, 250, 0.5, 0)
	if b["passed"] != true {
		t.Fatal(b)
	}
	if len(Phase12Catalog()) != 50 {
		t.Fatal(len(Phase12Catalog()))
	}
}

func TestPhase13EdgeFinOpsConnectors(t *testing.T) {
	if len(DefaultEdgeLocations()) < 3 {
		t.Fatal("edges")
	}
	profs := MobileProfiles()
	p95 := ApplyMobileNetwork(100, profs[2]) // 4g
	if p95 <= 100 {
		t.Fatal(p95)
	}
	est := EstimateFinOps(100, 3600, "eu-north-1", 1, 2)
	if est.TotalUSD <= 0 || est.CarbonKgCO2e <= 0 {
		t.Fatal(est)
	}
	if CarbonGrade(0.05) != "A" {
		t.Fatal(CarbonGrade(0.05))
	}
	hub := NewConnectorHub()
	if len(hub.List("ci")) < 2 {
		t.Fatal(hub.List("ci"))
	}
	c, err := hub.Connect("slack", map[string]string{"webhook": "https://hooks"})
	if err != nil || c.Status != "connected" {
		t.Fatal(c, err)
	}
	if err := hub.Disconnect("slack"); err != nil {
		t.Fatal(err)
	}
	led := NewDeliveryLedger()
	led.Record(DeliveryAttempt{ID: "1", Target: "slack", StatusCode: 500, Attempts: 1})
	if len(led.Recent(5)) != 1 {
		t.Fatal("ledger")
	}
	if !ShouldRetryDelivery(500, 1, 5) || ShouldRetryDelivery(200, 1, 5) || ShouldRetryDelivery(500, 5, 5) {
		t.Fatal("retry")
	}
	rep := SustainabilityReport([]FinOpsEstimate{est, est})
	if rep["count"] != 2 {
		t.Fatal(rep)
	}
	if len(Phase13Catalog()) != 50 {
		t.Fatal(len(Phase13Catalog()))
	}
	all, counts := AllPhaseCatalogs()
	// Waves 7–13 = 350; phase 14 = 20; phases 21–41 = 21 → 391
	if len(all) != 391 {
		t.Fatalf("want 391 got %d", len(all))
	}
	if counts["13"] != 50 || counts["11"] != 50 || counts["14"] != 20 || counts["21-41"] != 21 {
		t.Fatal(counts)
	}
}
