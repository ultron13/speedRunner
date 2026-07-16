package simulate

import (
	"context"
	"testing"
	"time"

	"github.com/belo/speedrunner/backend/internal/engine"
)

func TestSimulateEngineTick(t *testing.T) {
	ticks := 0
	e := New(func(runID string, m LiveMetrics) {
		ticks++
	})
	_, err := e.Execute(context.Background(), engine.ExecutionRequest{
		RunID:        "run-1",
		TestID:       "test-1",
		TargetURL:    "https://example.com",
		VirtualUsers: 50,
		Duration:     10,
	})
	if err != nil {
		t.Fatal(err)
	}
	// wait for at least one tick
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) && ticks == 0 {
		time.Sleep(50 * time.Millisecond)
	}
	if ticks == 0 {
		t.Fatal("expected at least one metric tick")
	}
	snap, ok := e.Snapshot("run-1")
	if !ok {
		t.Fatal("expected snapshot")
	}
	if snap.Throughput <= 0 {
		t.Fatalf("throughput=%v", snap.Throughput)
	}
	st, _ := e.GetStatus(context.Background(), "run-1")
	if st != "RUNNING" {
		t.Fatalf("status=%s", st)
	}
	if err := e.Cleanup(context.Background(), "run-1"); err != nil {
		t.Fatal(err)
	}
	st, _ = e.GetStatus(context.Background(), "run-1")
	if st != "UNKNOWN" {
		t.Fatalf("after cleanup status=%s", st)
	}
}

func TestRandomWalkBounds(t *testing.T) {
	v := 100.0
	for i := 0; i < 100; i++ {
		v = randomWalk(v, 0.15, 50, 200)
		if v < 50 || v > 200 {
			t.Fatalf("out of bounds: %v", v)
		}
	}
}
