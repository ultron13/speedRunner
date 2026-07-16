package ai

import "testing"

func TestDetect_NoAnomalyWithFlatHistory(t *testing.T) {
	d := NewDetector()
	hist := make([]MetricPoint, 10)
	for i := range hist {
		hist[i] = MetricPoint{Timestamp: int64(i), Value: 100}
	}
	// Slight noise still within threshold for flat series
	if f := d.Detect("response_time", hist, 100); f != nil {
		// flat baseline with same value should not flag
		t.Fatalf("expected no anomaly, got %+v", f)
	}
}

func TestDetect_Spike(t *testing.T) {
	d := NewDetector()
	hist := make([]MetricPoint, 20)
	for i := range hist {
		hist[i] = MetricPoint{Timestamp: int64(i), Value: 100 + float64(i%3)}
	}
	f := d.Detect("response_time", hist, 500)
	if f == nil {
		t.Fatal("expected anomaly for large spike")
	}
	if f.Severity == "" {
		t.Error("expected severity")
	}
	if f.Confidence <= 0 {
		t.Error("expected positive confidence")
	}
}

func TestRecommendLoadProfile(t *testing.T) {
	r := RecommendLoadProfile("smoke test for login", 0)
	if r["profile"] != "smoke" {
		t.Fatalf("expected smoke profile, got %v", r["profile"])
	}
	r2 := RecommendLoadProfile("soak endurance overnight", 100)
	if r2["profile"] != "soak" {
		t.Fatalf("expected soak, got %v", r2["profile"])
	}
}

func TestPercentile(t *testing.T) {
	vals := []float64{1, 2, 3, 4, 5}
	p50 := Percentile(vals, 50)
	if p50 != 3 {
		t.Fatalf("p50=%v want 3", p50)
	}
}
