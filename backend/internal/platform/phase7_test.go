package platform

import (
	"strings"
	"testing"
	"time"
)

func TestPrometheusAndRateLimit(t *testing.T) {
	txt := PrometheusText([]MetricSample{
		{Name: "sr_up", Help: "up", Type: "gauge", Value: 1},
		{Name: "sr_runs", Type: "counter", Value: 3, Labels: map[string]string{"status": "completed"}},
	})
	if !strings.Contains(txt, "sr_up 1") {
		t.Fatal(txt)
	}
	rl := NewRateLimiter(1, 1)
	if !rl.Allow("a") {
		t.Fatal("first should allow")
	}
	if rl.Allow("a") {
		t.Fatal("second should deny at burst 1")
	}
}

func TestWindowsFlagsApprovals(t *testing.T) {
	ff := NewFeatureFlags()
	if !ff.Get("chatops") {
		t.Fatal("default chatops")
	}
	ff.Set("chaos", true)
	if !ff.Get("chaos") {
		t.Fatal("set chaos")
	}
	mw := MaintenanceWindow{Enabled: true, Until: time.Now().Add(time.Hour)}
	if !mw.Active(time.Now()) {
		t.Fatal("maintenance")
	}
	ok, _ := InExecutionWindow(time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC), []TimeWindow{
		{StartHour: 9, EndHour: 17, Blackout: false},
	})
	if !ok {
		t.Fatal("should be in window")
	}
	as := NewApprovalStore()
	as.Request(&Approval{ID: "1", Resource: "run", ResourceID: "r1", RequestedBy: "u"})
	if err := as.Decide("1", "APPROVED", "admin", "ok"); err != nil {
		t.Fatal(err)
	}
	if len(as.List("APPROVED")) != 1 {
		t.Fatal("list")
	}
}

func TestCompareTrendNotifyArtifacts(t *testing.T) {
	cmp := CompareRuns(
		RunSnapshot{RunID: "a", AvgResponseTime: 100, P95: 200, Throughput: 50, ErrorRate: 0.5},
		RunSnapshot{RunID: "b", AvgResponseTime: 150, P95: 300, Throughput: 40, ErrorRate: 2},
	)
	if cmp["regression"] != true {
		t.Fatal(cmp)
	}
	pts := []TrendPoint{
		{Timestamp: time.Unix(0, 0), Value: 1},
		{Timestamp: time.Unix(60, 0), Value: 3},
		{Timestamp: time.Unix(120, 0), Value: 5},
	}
	agg := AggregateTrend(pts, 2)
	if len(agg) == 0 {
		t.Fatal("agg")
	}
	bus := NewNotificationBus()
	bus.Publish(Notification{ID: "n1", Channel: "slack", Title: "hi", Body: "body", Level: "info"})
	if len(bus.Recent(10)) != 1 {
		t.Fatal("notify")
	}
	arts := NewArtifactStore()
	arts.Put(&Artifact{ID: "a1", RunID: "r1", Name: "out.jtl", Type: "jtl", SizeBytes: 10, URI: "mem://a"})
	if len(arts.ListByRun("r1")) != 1 {
		t.Fatal("artifacts")
	}
}

func TestSecurityChargebackHealth(t *testing.T) {
	red := RedactSecrets("password=supersecret Bearer abc.def.ghi")
	if strings.Contains(red, "supersecret") {
		t.Fatal(red)
	}
	if !IPAllowed("10.0.0.5", []string{"10.0.0.0/8"}) {
		t.Fatal("cidr")
	}
	ok, score, issues := PasswordStrength("Short1!")
	if ok {
		t.Fatalf("weak password should fail score=%d issues=%v", score, issues)
	}
	ok, _, _ = PasswordStrength("LongerPass1!")
	if !ok {
		t.Fatal("strong password")
	}
	if len(HashToken("x")) != 64 {
		t.Fatal("sha256 hex")
	}
	cb := BuildChargeback([]ChargebackLine{{Team: "a", CostUSD: 10, Runs: 2}})
	if cb["totalUsd"].(float64) != 10 {
		t.Fatal(cb)
	}
	if !ShouldPurge(time.Now().AddDate(0, 0, -100), 30, time.Now()) {
		t.Fatal("purge")
	}
	if APIVersionHeaders("")["X-API-Version"] != "v1" {
		t.Fatal("version")
	}
	if len(DefaultWorkloadProfiles()) < 3 {
		t.Fatal("workloads")
	}
	if len(BrowserJourneys()) < 2 {
		t.Fatal("journeys")
	}
	board := BuildReleaseBoard([]ReleaseBoardItem{
		{Service: "api", Gate: "PASS", Risk: "low"},
		{Service: "pay", Gate: "FAIL", Risk: "high"},
	})
	if board["overall"] != "FAIL" {
		t.Fatal(board)
	}
	hm := HealthMatrix(true, false, false, true)
	if len(hm) < 4 {
		t.Fatal(hm)
	}
	diag := DiagnosticBundle("0.4.0", 12, hm)
	if diag["version"] != "0.4.0" {
		t.Fatal(diag)
	}
	if len(PhaseCatalog()) != 50 {
		t.Fatalf("expected 50 phases, got %d", len(PhaseCatalog()))
	}
}
