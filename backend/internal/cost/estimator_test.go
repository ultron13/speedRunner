package cost

import "testing"

func TestEstimateBasic(t *testing.T) {
	e := NewDefault()
	est := e.Estimate(EstimateInput{
		VirtualUsers: 100,
		DurationSec:  600,
		Engine:       "jmeter",
		NetworkGB:    1,
		ArtifactGB:   0.5,
	})
	if est.TotalUSD <= 0 {
		t.Fatalf("expected positive total, got %v", est)
	}
	if est.Workers < 1 {
		t.Fatalf("expected workers >= 1, got %d", est.Workers)
	}
	if est.Currency != "USD" {
		t.Fatalf("currency=%s", est.Currency)
	}
}

func TestEstimateMinDuration(t *testing.T) {
	e := NewDefault()
	est := e.Estimate(EstimateInput{VirtualUsers: 10, DurationSec: 0, Engine: "simulate"})
	if est.TotalUSD < 0 {
		t.Fatal("total should not be negative")
	}
}
