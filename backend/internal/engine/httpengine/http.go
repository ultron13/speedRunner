package httpengine

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/belo/speedrunner/backend/internal/engine"
)

// Engine generates real HTTP load against a target URL using concurrent workers.
// Suitable for light local/dev validation — not a replacement for JMeter/k6 at scale.
type Engine struct {
	mu     sync.Mutex
	cancel map[string]context.CancelFunc
	status map[string]string
}

func New() *Engine {
	return &Engine{
		cancel: make(map[string]context.CancelFunc),
		status: make(map[string]string),
	}
}

func (e *Engine) Name() string { return "http" }

func (e *Engine) Execute(ctx context.Context, req engine.ExecutionRequest) (*engine.ExecutionResult, error) {
	if req.TargetURL == "" {
		return nil, fmt.Errorf("target URL is required")
	}
	vus := req.VirtualUsers
	if vus <= 0 {
		vus = 1
	}
	if vus > 100 {
		vus = 100 // safety cap for in-process engine
	}
	duration := req.Duration
	if duration <= 0 {
		duration = 60
	}

	runCtx, cancel := context.WithTimeout(ctx, time.Duration(duration)*time.Second)
	e.mu.Lock()
	e.cancel[req.RunID] = cancel
	e.status[req.RunID] = "RUNNING"
	e.mu.Unlock()

	started := time.Now()
	var totalReqs, totalErrs int64
	var totalLatencyNs int64

	var wg sync.WaitGroup
	for i := 0; i < vus; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			client := &http.Client{Timeout: 10 * time.Second}
			for {
				select {
				case <-runCtx.Done():
					return
				default:
				}
				start := time.Now()
				resp, err := client.Get(req.TargetURL)
				lat := time.Since(start).Nanoseconds()
				atomic.AddInt64(&totalLatencyNs, lat)
				atomic.AddInt64(&totalReqs, 1)
				if err != nil {
					atomic.AddInt64(&totalErrs, 1)
					continue
				}
				_, _ = io.Copy(io.Discard, resp.Body)
				_ = resp.Body.Close()
				if resp.StatusCode >= 400 {
					atomic.AddInt64(&totalErrs, 1)
				}
				// small think time
				time.Sleep(50 * time.Millisecond)
			}
		}()
	}

	// Wait in background; return immediately as RUNNING for async orchestration.
	go func() {
		wg.Wait()
		cancel()
		e.mu.Lock()
		e.status[req.RunID] = "COMPLETED"
		delete(e.cancel, req.RunID)
		e.mu.Unlock()
	}()

	// Snapshot after a brief warm-up if context already done (short tests)
	elapsed := time.Since(started).Seconds()
	reqs := atomic.LoadInt64(&totalReqs)
	errs := atomic.LoadInt64(&totalErrs)
	latNs := atomic.LoadInt64(&totalLatencyNs)

	var avgRT, tp, errRate float64
	if reqs > 0 {
		avgRT = float64(latNs) / float64(reqs) / 1e6
		errRate = float64(errs) / float64(reqs) * 100
	}
	if elapsed > 0 {
		tp = float64(reqs) / elapsed
	}

	return &engine.ExecutionResult{
		RunID:       req.RunID,
		Status:      "RUNNING",
		StartedAt:   started,
		Duration:    elapsed,
		Throughput:  tp,
		AvgRespTime: avgRT,
		ErrorRate:   errRate,
	}, nil
}

func (e *Engine) GetStatus(ctx context.Context, runID string) (string, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if s, ok := e.status[runID]; ok {
		return s, nil
	}
	return "UNKNOWN", nil
}

func (e *Engine) Cleanup(ctx context.Context, runID string) error {
	e.mu.Lock()
	defer e.mu.Unlock()
	if cancel, ok := e.cancel[runID]; ok {
		cancel()
		delete(e.cancel, runID)
	}
	e.status[runID] = "CANCELLED"
	return nil
}
