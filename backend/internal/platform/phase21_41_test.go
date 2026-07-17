package platform

import (
	"testing"
	"time"
)

func TestPhase21to41(t *testing.T) {
	sum := PortfolioSummary([]PortfolioProject{
		{Name: "A", OpenRisks: 1, SLAPassRate: 90, HealthScore: 80},
		{Name: "B", OpenRisks: 4, SLAPassRate: 70, HealthScore: 50},
	})
	if sum["projectCount"] != 2 {
		t.Fatal(sum)
	}

	vs := NewAssetVersionStore()
	v1 := vs.Commit("script-1", "alice", "init", "content-a")
	v2 := vs.Commit("script-1", "bob", "fix", "content-b")
	if v1.Version != 1 || v2.Version != 2 || len(vs.History("script-1")) != 2 {
		t.Fatal(v1, v2)
	}

	ok, _ := MergeBranchAllowed(ScriptBranch{Name: "main", Protected: true, HeadSHA: "a"}, ScriptBranch{Name: "feat", HeadSHA: "b"}, false)
	if ok {
		t.Fatal("protected")
	}

	params := SuggestParameters("/api/users/{id}", `{"email":"x","password":"y"}`)
	if len(params) < 2 {
		t.Fatal(params)
	}

	corr := DetectCorrelations(`{"access_token":"abc","csrf":"tok"}`)
	if len(corr) < 2 {
		t.Fatal(corr)
	}

	wan := WANProfiles()
	p95 := ApplyWAN(100, wan[2])
	if p95 <= 100 {
		t.Fatal(p95)
	}
	if len(ThinkTimeLibrary()) < 3 {
		t.Fatal("think")
	}

	heal := AutoHealAction(LGHealth{GeneratorID: "g1", Unreachable: true})
	if heal["severity"] != "critical" {
		t.Fatal(heal)
	}

	agg := AggregateShards([]ShardResult{
		{ShardID: "1", Samples: 100, Throughput: 50, AvgLatency: 100, ErrorCount: 2},
		{ShardID: "2", Samples: 100, Throughput: 40, AvgLatency: 120, ErrorCount: 0},
	})
	if agg["samples"] != 200 {
		t.Fatal(agg)
	}

	mx := ComparisonMatrix([]RunMatrixRow{
		{RunID: "r1", P95: 200, Throughput: 10},
		{RunID: "r2", P95: 150, Throughput: 20},
	})
	if mx["bestP95"] != "r2" || mx["bestThroughput"] != "r2" {
		t.Fatal(mx)
	}

	pack := ExecutiveBoardPack("Q3", 55, []string{"a", "b", "c"}, 120)
	if pack["status"] != "RED" {
		t.Fatal(pack)
	}

	inc := DraftIncidentFromSLA("checkout", "run-1", 6, 2500)
	if inc["severity"] != "critical" {
		t.Fatal(inc)
	}
	if len(EscalationPlan("critical")) < 2 {
		t.Fatal("esc")
	}

	q := CheckQuota(ResourceQuota{MaxVUs: 100, MaxConcurrent: 2, MaxDailyRuns: 10}, 120, 1, 5)
	if q["allowed"] != false {
		t.Fatal(q)
	}

	bg := BlueGreenSwitch(EnvSlot{Name: "blue", Healthy: true}, EnvSlot{Name: "green", Version: "v2", Healthy: true}, false)
	if bg["ok"] != true || bg["active"] != "green" {
		t.Fatal(bg)
	}

	res := ResidencyGate([]string{"eu-west-1", "eu-central-1"}, "us-east-1", "pii")
	if res["allowed"] != false {
		t.Fatal(res)
	}

	now := time.Now()
	conf := CalendarConflicts([]CalendarEvent{
		{ID: "1", Env: "prod", StartsAt: now, DurationM: 60},
		{ID: "2", Env: "prod", StartsAt: now.Add(30 * time.Minute), DurationM: 60},
	})
	if len(conf) != 1 {
		t.Fatal(conf)
	}

	flaky := DetectFlaky([]bool{true, false, true, false, true})
	if flaky["flaky"] != true {
		t.Fatal(flaky)
	}

	reg := RegressionAgainstBaseline([]float64{100, 105, 98, 102, 100}, 200, 2.5)
	if reg["regression"] != true {
		t.Fatal(reg)
	}

	health := PlatformSelfHealth([]PlatformComponent{
		{Name: "api", OK: true, Latency: 20},
		{Name: "db", OK: true, Latency: 30},
		{Name: "redis", OK: false, Latency: 5},
	})
	if health["status"] == "unknown" {
		t.Fatal(health)
	}

	if len(Phase21to41Catalog()) != 21 {
		t.Fatalf("catalog %d", len(Phase21to41Catalog()))
	}
}
