package controller

import (
	"context"
	"fmt"
	"time"

	"github.com/belo/speedrunner/backend/internal/engine"
)

// RunState represents the lifecycle state of a test run
type RunState string

const (
	StatePending    RunState = "PENDING"
	StateValidating RunState = "VALIDATING"
	StateProvision  RunState = "PROVISIONING"
	StateRunning    RunState = "RUNNING"
	StateCollecting RunState = "COLLECTING"
	StateCompleted  RunState = "COMPLETED"
	StateFailed     RunState = "FAILED"
	StateCancelled  RunState = "CANCELLED"
)

// Run represents a test execution run
type Run struct {
	ID           string
	TestID       string
	State        RunState
	StartedAt    time.Time
	CompletedAt  *time.Time
	VirtualUsers int
	Duration     int
	TargetURL    string
	Error        string
}

// Controller manages test run lifecycle
type Controller struct {
	engines  *engine.Registry
	runStore map[string]*Run
}

func New(engines *engine.Registry) *Controller {
	return &Controller{
		engines:  engines,
		runStore: make(map[string]*Run),
	}
}

// StartRun initiates a new test execution
func (c *Controller) StartRun(ctx context.Context, req engine.ExecutionRequest) (*Run, error) {
	run := &Run{
		ID:           req.RunID,
		TestID:       req.TestID,
		State:        StatePending,
		StartedAt:    time.Now(),
		VirtualUsers: req.VirtualUsers,
		Duration:     req.Duration,
		TargetURL:    req.TargetURL,
	}

	// Validate
	run.State = StateValidating
	if err := c.validate(ctx, run); err != nil {
		run.State = StateFailed
		run.Error = err.Error()
		c.runStore[run.ID] = run
		return run, err
	}

	// Provision
	run.State = StateProvision
	e, err := c.engines.Get("jmeter")
	if err != nil {
		run.State = StateFailed
		run.Error = err.Error()
		c.runStore[run.ID] = run
		return run, err
	}

	// Execute
	run.State = StateRunning
	result, err := e.Execute(ctx, req)
	if err != nil {
		run.State = StateFailed
		run.Error = err.Error()
		c.runStore[run.ID] = run
		return run, err
	}

	_ = result
	c.runStore[run.ID] = run

	return run, nil
}

// GetRun returns the current state of a run
func (c *Controller) GetRun(runID string) (*Run, bool) {
	run, ok := c.runStore[runID]
	return run, ok
}

// StopRun cancels a running test
func (c *Controller) StopRun(ctx context.Context, runID string) error {
	run, ok := c.runStore[runID]
	if !ok {
		return fmt.Errorf("run %s not found", runID)
	}

	if run.State != StateRunning {
		return fmt.Errorf("run %s is not running (state: %s)", runID, run.State)
	}

	e, err := c.engines.Get("jmeter")
	if err != nil {
		return err
	}

	if err := e.Cleanup(ctx, runID); err != nil {
		return fmt.Errorf("cleanup failed: %w", err)
	}

	now := time.Now()
	run.State = StateCancelled
	run.CompletedAt = &now

	return nil
}

func (c *Controller) validate(ctx context.Context, run *Run) error {
	if run.VirtualUsers <= 0 {
		return fmt.Errorf("virtual users must be positive")
	}
	if run.Duration <= 0 {
		return fmt.Errorf("duration must be positive")
	}
	if run.TargetURL == "" {
		return fmt.Errorf("target URL is required")
	}
	return nil
}
