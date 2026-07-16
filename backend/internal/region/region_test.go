package region

import "testing"

func TestReserveAndPick(t *testing.T) {
	r := NewRegistry()
	if err := r.Reserve("local", 100); err != nil {
		t.Fatal(err)
	}
	reg, err := r.PickBest(50)
	if err != nil {
		t.Fatal(err)
	}
	if reg == nil {
		t.Fatal("nil region")
	}
	r.Release("local", 100)
	loc, ok := r.Get("local")
	if !ok || loc.UsedVUs != 0 {
		t.Fatalf("used=%d", loc.UsedVUs)
	}
}
