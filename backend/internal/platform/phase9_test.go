package platform

import (
	"testing"
	"time"
)

func TestRegionFailover(t *testing.T) {
	regions := []RegionHealth{
		{Name: "us-east", Healthy: true, LatencyMs: 40, ErrorRate: 0.5, CapacityVU: 1000, UsedVU: 200},
		{Name: "eu-west", Healthy: true, LatencyMs: 80, ErrorRate: 1.0, CapacityVU: 800, UsedVU: 700},
		{Name: "ap-south", Healthy: false, LatencyMs: 200, ErrorRate: 10, CapacityVU: 500, UsedVU: 100},
	}
	primary, ok := PickPrimaryRegion(regions)
	if !ok || primary.Name != "us-east" {
		t.Fatalf("primary=%v ok=%v", primary, ok)
	}
	plan := FailoverPlan(regions)
	if plan["primary"] != "us-east" {
		t.Fatal(plan)
	}
	secs := plan["secondaries"].([]string)
	if len(secs) != 1 || secs[0] != "eu-west" {
		t.Fatal(secs)
	}
	if RegionScore(regions[2]) != 0 {
		t.Fatal("unhealthy score")
	}
}

func TestDRBackup(t *testing.T) {
	ev := EvaluateDR(DRPolicy{
		Name: "core", RPOMinutes: 60, RTOMinutes: 90, Regions: 2, LastBackupAge: 30, BackupCron: "0 * * * *",
	})
	if ev["rpoMet"] != true || ev["tier"] != "silver" {
		t.Fatal(ev)
	}
	gold := EvaluateDR(DRPolicy{Regions: 3, RPOMinutes: 10, RTOMinutes: 20, LastBackupAge: 5})
	if gold["tier"] != "gold" {
		t.Fatal(gold)
	}
	if !BackupScheduleOK("0 * * * *", time.Now().Add(-30*time.Minute), time.Hour) {
		t.Fatal("backup schedule")
	}
	if BackupScheduleOK("", time.Now(), time.Hour) {
		t.Fatal("empty cron")
	}
}

func TestObservabilitySynthetic(t *testing.T) {
	if !ShouldSample("abcdefgh", 1) {
		t.Fatal("full sample")
	}
	if ShouldSample("abcdefgh", 0) {
		t.Fatal("zero sample")
	}
	// deterministic
	a := ShouldSample("trace-xyz", 0.5)
	b := ShouldSample("trace-xyz", 0.5)
	if a != b {
		t.Fatal("not deterministic")
	}
	corr := CorrelateRunTraces("r1", []TraceSample{
		{Service: "api", DurationMs: 10, Status: "ok"},
		{Service: "db", DurationMs: 20, Status: "error"},
	})
	if corr["spanCount"] != 2 || corr["errorSpans"] != float64(1) {
		t.Fatal(corr)
	}
	store := NewSyntheticStore()
	store.Upsert(SyntheticCheck{ID: "1", Name: "home", LastOK: true})
	store.Upsert(SyntheticCheck{ID: "2", Name: "login", LastOK: false})
	ev := EvaluateSynthetic(store.List(), 0.2)
	if ev["status"] != "critical" {
		t.Fatal(ev)
	}
	empty := EvaluateSynthetic(nil, 0.1)
	if empty["status"] != "unknown" {
		t.Fatal(empty)
	}
	allOK := EvaluateSynthetic([]SyntheticCheck{{LastOK: true}, {LastOK: true}}, 0.1)
	if allOK["status"] != "healthy" {
		t.Fatal(allOK)
	}
}

func TestCanaryCapacityExportRollout(t *testing.T) {
	wait := AnalyzeCanary(CanarySnapshot{SampleSize: 5, MinSample: 100})
	if wait["decision"] != "wait" {
		t.Fatal(wait)
	}
	prom := AnalyzeCanary(CanarySnapshot{
		BaselineErrorRate: 0.5, CanaryErrorRate: 0.4,
		BaselineP95Ms: 100, CanaryP95Ms: 105,
		SampleSize: 200, MinSample: 50, CanaryTrafficPct: 10,
	})
	if prom["decision"] != "promote" {
		t.Fatal(prom)
	}
	rb := AnalyzeCanary(CanarySnapshot{
		BaselineErrorRate: 0.5, CanaryErrorRate: 2.0,
		BaselineP95Ms: 100, CanaryP95Ms: 100,
		SampleSize: 200, MinSample: 50,
	})
	if rb["decision"] != "rollback" {
		t.Fatal(rb)
	}
	cap := PlanCapacity(CapacityInput{
		PeakVUs: 900, Nodes: 2, NodeCapacityVUs: 500, TargetHeadroom: 0.2, GrowthPctMonth: 10, HorizonMonths: 3,
	})
	if cap["status"] != "scale_up" && cap["status"] != "critical" {
		// util = 900/1000 = 0.9 > 0.8 headroom target → scale_up
		t.Fatal(cap)
	}
	bundle := BuildExportBundle(
		[]map[string]interface{}{{"name": "t1"}},
		[]map[string]interface{}{{"name": "s1"}},
		map[string]bool{"ai": true},
	)
	ok, issues := ValidateImportBundle(bundle)
	if !ok {
		t.Fatal(issues)
	}
	bad, _ := ValidateImportBundle(ExportBundle{})
	if bad {
		t.Fatal("empty should fail")
	}
	if !RolloutEnabled(Rollout{Feature: "x", Percent: 100}, "u1") {
		t.Fatal("100")
	}
	if RolloutEnabled(Rollout{Feature: "x", Percent: 0}, "u1") {
		t.Fatal("0")
	}
	// deterministic
	if RolloutEnabled(Rollout{Percent: 50}, "user-a") != RolloutEnabled(Rollout{Percent: 50}, "user-a") {
		t.Fatal("rollout det")
	}
	if len(Phase9Catalog()) != 50 {
		t.Fatalf("want 50 got %d", len(Phase9Catalog()))
	}
}
