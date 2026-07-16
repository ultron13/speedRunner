package operator

import (
	"context"
	"testing"

	"github.com/belo/speedrunner/backend/internal/engine"
)

type fakeExec struct{}

func (f fakeExec) StartEngine(ctx context.Context, req engine.ExecutionRequest) (string, error) {
	return req.RunID, nil
}
func (f fakeExec) StopEngine(ctx context.Context, runID string) error { return nil }
func (f fakeExec) EngineStatus(ctx context.Context, engineName, runID string) (string, error) {
	return "RUNNING", nil
}

func TestReconcilerUpsert(t *testing.T) {
	r := NewReconciler(fakeExec{})
	st := r.Upsert(TestRunSpec{
		Name: "run-a", TargetURL: "https://example.com", VirtualUsers: 10, Engine: "simulate",
	})
	if st.Phase != "Pending" {
		t.Fatalf("phase=%s", st.Phase)
	}
	r.reconcileOne(context.Background(), "run-a")
	st, ok := r.GetStatus("run-a")
	if !ok || st.Phase != "Running" {
		t.Fatalf("status=%+v ok=%v", st, ok)
	}
}
