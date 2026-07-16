package ai

import "testing"

func TestReviewScript(t *testing.T) {
	f := ReviewScript("k6", "export default function() { http.get('x') }")
	if len(f) == 0 {
		t.Fatal("expected findings")
	}
}

func TestGenerateAndSummary(t *testing.T) {
	s := GenerateStarterScript("k6", "https://example.com", []string{"/api"})
	if s["script"] == nil || s["draft"] != true {
		t.Fatalf("%v", s)
	}
	sum := RunSummary("executive", 200, 400, 50, 0.5, "COMPLETED")
	if sum["risk"] == "" && sum["summary"] == "" {
		t.Fatalf("%v", sum)
	}
	gate := ReleaseGate(2000, 100, 10, 1, 5)
	if gate["passed"] != false {
		t.Fatal("expected fail")
	}
	fc := ForecastCapacity(10, 80, 800)
	if fc["recommendedVUs"].(int) < 10 {
		t.Fatalf("%v", fc)
	}
	draft := DefectDraft("Slow checkout", "high", []string{"p95=2s"}, "perf")
	if draft["jira"] == nil {
		t.Fatal("missing jira")
	}
}

func TestSyntheticAndPools(t *testing.T) {
	rows := GenerateSyntheticData(nil, 5, true)
	if len(rows) != 5 {
		t.Fatal(len(rows))
	}
	rec := DataPoolRecommendation("login tokens", 500)
	if rec["keyPrefix"] == nil {
		t.Fatal(rec)
	}
}
