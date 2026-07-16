package operator

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/belo/speedrunner/backend/internal/engine"
)

// TestRunSpec is the desired state for a platform TestRun CR equivalent.
type TestRunSpec struct {
	Name         string
	TestID       string
	TargetURL    string
	VirtualUsers int
	DurationSec  int
	Engine       string
	Region       string
	Namespace    string
}

// TestRunStatus is observed state.
type TestRunStatus struct {
	Phase       string    `json:"phase"`
	RunID       string    `json:"runId"`
	JobName     string    `json:"jobName,omitempty"`
	Message     string    `json:"message,omitempty"`
	StartedAt   time.Time `json:"startedAt,omitempty"`
	CompletedAt time.Time `json:"completedAt,omitempty"`
}

// Executor starts/stops platform runs (implemented by RunnerOrchestrator adapter).
type Executor interface {
	StartEngine(ctx context.Context, req engine.ExecutionRequest) (runID string, err error)
	StopEngine(ctx context.Context, runID string) error
	EngineStatus(ctx context.Context, engineName, runID string) (string, error)
}

// Reconciler implements a simple in-process operator loop for TestRun specs.
type Reconciler struct {
	mu        sync.Mutex
	desired   map[string]TestRunSpec
	status    map[string]TestRunStatus
	executor  Executor
	interval  time.Duration
}

func NewReconciler(exec Executor) *Reconciler {
	return &Reconciler{
		desired:  make(map[string]TestRunSpec),
		status:   make(map[string]TestRunStatus),
		executor: exec,
		interval: 5 * time.Second,
	}
}

// Upsert registers or updates a desired TestRun.
func (r *Reconciler) Upsert(spec TestRunSpec) TestRunStatus {
	r.mu.Lock()
	defer r.mu.Unlock()
	if spec.Name == "" {
		spec.Name = uuid.New().String()
	}
	r.desired[spec.Name] = spec
	st, ok := r.status[spec.Name]
	if !ok {
		st = TestRunStatus{Phase: "Pending"}
		r.status[spec.Name] = st
	}
	return st
}

// GetStatus returns observed status.
func (r *Reconciler) GetStatus(name string) (TestRunStatus, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	st, ok := r.status[name]
	return st, ok
}

// List returns all managed runs.
func (r *Reconciler) List() []TestRunStatus {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]TestRunStatus, 0, len(r.status))
	for name, st := range r.status {
		st.Message = name + ": " + st.Message
		out = append(out, st)
	}
	return out
}

// Delete marks a run for cancellation.
func (r *Reconciler) Delete(name string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if st, ok := r.status[name]; ok && st.RunID != "" && r.executor != nil {
		_ = r.executor.StopEngine(context.Background(), st.RunID)
		st.Phase = "Cancelled"
		st.CompletedAt = time.Now()
		r.status[name] = st
	}
	delete(r.desired, name)
}

// Run starts the reconciliation loop until ctx is cancelled.
func (r *Reconciler) Run(ctx context.Context) {
	t := time.NewTicker(r.interval)
	defer t.Stop()
	log.Println("[operator] reconciler started")
	for {
		select {
		case <-ctx.Done():
			log.Println("[operator] reconciler stopped")
			return
		case <-t.C:
			r.reconcileOnce(ctx)
		}
	}
}

func (r *Reconciler) reconcileOnce(ctx context.Context) {
	r.mu.Lock()
	names := make([]string, 0, len(r.desired))
	for n := range r.desired {
		names = append(names, n)
	}
	r.mu.Unlock()

	for _, name := range names {
		r.reconcileOne(ctx, name)
	}
}

func (r *Reconciler) reconcileOne(ctx context.Context, name string) {
	r.mu.Lock()
	spec, ok := r.desired[name]
	st := r.status[name]
	r.mu.Unlock()
	if !ok {
		return
	}

	switch st.Phase {
	case "", "Pending":
		if r.executor == nil {
			st.Phase = "Failed"
			st.Message = "executor not configured"
			r.setStatus(name, st)
			return
		}
		eng := spec.Engine
		if eng == "" {
			eng = "simulate"
		}
		runID := uuid.New().String()
		req := engine.ExecutionRequest{
			RunID:        runID,
			TestID:       spec.TestID,
			TargetURL:    spec.TargetURL,
			VirtualUsers: spec.VirtualUsers,
			Duration:     spec.DurationSec,
			Namespace:    spec.Namespace,
			Labels:       map[string]string{"operator": "true", "cr": name, "engine": eng},
		}
		if req.Duration <= 0 {
			req.Duration = 300
		}
		id, err := r.executor.StartEngine(ctx, req)
		if err != nil {
			st.Phase = "Failed"
			st.Message = err.Error()
			r.setStatus(name, st)
			return
		}
		if id != "" {
			runID = id
		}
		st.Phase = "Running"
		st.RunID = runID
		st.StartedAt = time.Now()
		st.Message = fmt.Sprintf("started engine=%s", eng)
		r.setStatus(name, st)

	case "Running":
		if r.executor == nil || st.RunID == "" {
			return
		}
		eng := spec.Engine
		if eng == "" {
			eng = "simulate"
		}
		phase, err := r.executor.EngineStatus(ctx, eng, st.RunID)
		if err != nil {
			return
		}
		switch phase {
		case "COMPLETED":
			st.Phase = "Succeeded"
			st.CompletedAt = time.Now()
			st.Message = "completed"
			r.setStatus(name, st)
		case "FAILED":
			st.Phase = "Failed"
			st.CompletedAt = time.Now()
			st.Message = "engine failed"
			r.setStatus(name, st)
		}
	}
}

func (r *Reconciler) setStatus(name string, st TestRunStatus) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.status[name] = st
}
