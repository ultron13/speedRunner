package keda

import "testing"

func TestRecommend(t *testing.T) {
	recs := Recommend(10, 3, 250, 40)
	if len(recs) < 3 {
		t.Fatalf("expected >=3 recs, got %d", len(recs))
	}
	if recs[0].Desired < 1 {
		t.Fatal("controller desired too low")
	}
}
