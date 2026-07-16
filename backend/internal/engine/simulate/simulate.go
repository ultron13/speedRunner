package simulate

import (
	"context"
	"math"
	"math/rand"
	"sync"
	"time"

	"github.com/belo/speedrunner/backend/internal/engine"
)

// Engine is an in-process simulation engine for demo and local development.
// It produces realistic bounded random-walk metrics without generating real load.
type Engine struct {
	mu    sync.Mutex
	runs  map[string]*liveRun
	onTick func(runID string, metrics LiveMetrics)
}

type LiveMetrics struct {
	Duration        float64 `json:"duration"`
	Throughput      float64 `json:"throughput"`
	AvgResponseTime float64 `json:"avgResponseTime"`
	ErrorRate       float64 `json:"errorRate"`
	ActiveVUsers    int     `json:"activeVUsers"`
	P50             float64 `json:"p50"`
	P90             float64 `json:"p90"`
	P95             float64 `json:"p95"`
	P99             float64 `json:"p99"`
}

type liveRun struct {
	req       engine.ExecutionRequest
	metrics   LiveMetrics
	startedAt time.Time
	stopCh    chan struct{}
	done      bool
}

func New(onTick func(runID string, metrics LiveMetrics)) *Engine {
	return &Engine{
		runs:   make(map[string]*liveRun),
		onTick: onTick,
	}
}

func (e *Engine) Name() string { return "simulate" }

func (e *Engine) Execute(ctx context.Context, req engine.ExecutionRequest) (*engine.ExecutionResult, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	vus := req.VirtualUsers
	if vus <= 0 {
		vus = 10
	}

	baseTP := float64(vus) * 0.8
	baseRT := 200.0 + float64(vus)*2.0

	lr := &liveRun{
		req:       req,
		startedAt: time.Now(),
		stopCh:    make(chan struct{}),
		metrics: LiveMetrics{
			Duration:        0,
			Throughput:      baseTP,
			AvgResponseTime: baseRT,
			ErrorRate:       1.5,
			ActiveVUsers:    vus,
			P50:             baseRT * 0.85,
			P90:             baseRT * 1.2,
			P95:             baseRT * 1.4,
			P99:             baseRT * 1.8,
		},
	}
	e.runs[req.RunID] = lr

	go e.loop(req.RunID)

	// Non-blocking: simulation continues in background until Stop/Cleanup.
	return &engine.ExecutionResult{
		RunID:     req.RunID,
		Status:    "RUNNING",
		StartedAt: lr.startedAt,
	}, nil
}

func (e *Engine) GetStatus(ctx context.Context, runID string) (string, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	lr, ok := e.runs[runID]
	if !ok {
		return "UNKNOWN", nil
	}
	if lr.done {
		return "COMPLETED", nil
	}
	return "RUNNING", nil
}

func (e *Engine) Cleanup(ctx context.Context, runID string) error {
	e.mu.Lock()
	defer e.mu.Unlock()
	lr, ok := e.runs[runID]
	if !ok {
		return nil
	}
	if !lr.done {
		close(lr.stopCh)
		lr.done = true
	}
	delete(e.runs, runID)
	return nil
}

// Snapshot returns the latest metrics for a run.
func (e *Engine) Snapshot(runID string) (LiveMetrics, bool) {
	e.mu.Lock()
	defer e.mu.Unlock()
	lr, ok := e.runs[runID]
	if !ok {
		return LiveMetrics{}, false
	}
	return lr.metrics, true
}

// ActiveRuns returns IDs of currently simulating runs.
func (e *Engine) ActiveRuns() []string {
	e.mu.Lock()
	defer e.mu.Unlock()
	ids := make([]string, 0, len(e.runs))
	for id, lr := range e.runs {
		if !lr.done {
			ids = append(ids, id)
		}
	}
	return ids
}

func (e *Engine) loop(runID string) {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for {
		e.mu.Lock()
		lr, ok := e.runs[runID]
		if !ok || lr.done {
			e.mu.Unlock()
			return
		}
		stopCh := lr.stopCh
		e.mu.Unlock()

		select {
		case <-stopCh:
			return
		case <-ticker.C:
			e.tickOnce(runID)
		}
	}
}

func (e *Engine) tickOnce(runID string) {
	e.mu.Lock()
	lr, ok := e.runs[runID]
	if !ok || lr.done {
		e.mu.Unlock()
		return
	}

	m := lr.metrics
	m.Duration += 1
	m.Throughput = randomWalk(m.Throughput, 0.10, 0.1, math.MaxFloat64)
	m.AvgResponseTime = randomWalk(m.AvgResponseTime, 0.15, 50, 10000)
	m.ErrorRate = randomWalk(m.ErrorRate, 0.01, 0, 100)
	// Keep absolute delta for error rate (percentage points)
	m.ErrorRate = clamp(m.ErrorRate+((rand.Float64()-0.5)*2), 0, 100)
	m.P50 = m.AvgResponseTime * 0.85
	m.P90 = m.AvgResponseTime * 1.2
	m.P95 = m.AvgResponseTime * 1.4
	m.P99 = m.AvgResponseTime * 1.8
	lr.metrics = m
	cb := e.onTick
	e.mu.Unlock()

	if cb != nil {
		cb(runID, m)
	}
}

func randomWalk(current, pct, min, max float64) float64 {
	delta := (rand.Float64() - 0.5) * 2 * pct * current
	return clamp(current+delta, min, max)
}

func clamp(v, min, max float64) float64 {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}
