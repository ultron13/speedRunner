package server

import (
	"context"
	"fmt"

	"github.com/belo/speedrunner/backend/internal/db/queries"
	"github.com/belo/speedrunner/backend/internal/engine"
)

// runnerExecutor adapts RunnerOrchestrator to operator.Executor.
type runnerExecutor struct {
	runner *RunnerOrchestrator
	tests  *queries.TestQueries
}

func (e *runnerExecutor) StartEngine(ctx context.Context, req engine.ExecutionRequest) (string, error) {
	if e.runner == nil {
		return "", fmt.Errorf("runner not configured")
	}
	// Build a minimal test-like object for Start
	test := &queries.Test{
		ID:           req.TestID,
		TargetURL:    req.TargetURL,
		VirtualUsers: req.VirtualUsers,
		ScriptType:   req.Labels["engine"],
	}
	if test.ScriptType == "" {
		test.ScriptType = "HTTP"
	}
	if test.ID == "" {
		test.ID = req.RunID
	}
	// Prefer direct registry execute for operator
	engName := e.runner.resolveEngine(test.ScriptType)
	if req.Labels["engine"] != "" {
		engName = req.Labels["engine"]
	}
	// Use Start which also creates companion sim metrics
	if err := e.runner.Start(ctx, req.RunID, test); err != nil {
		// fallback: try registry engine by name
		if eng, err2 := e.runner.registry.Get(engName); err2 == nil {
			if _, err3 := eng.Execute(ctx, req); err3 != nil {
				return "", err3
			}
			return req.RunID, nil
		}
		return "", err
	}
	return req.RunID, nil
}

func (e *runnerExecutor) StopEngine(ctx context.Context, runID string) error {
	if e.runner == nil {
		return nil
	}
	return e.runner.Stop(ctx, runID, "STOPPED")
}

func (e *runnerExecutor) EngineStatus(ctx context.Context, engineName, runID string) (string, error) {
	if e.runner == nil {
		return "UNKNOWN", nil
	}
	if snap, ok := e.runner.LiveSnapshot(runID); ok && snap.Duration >= 0 {
		// still active in sim companion
		if eng, err := e.runner.registry.Get(engineName); err == nil {
			return eng.GetStatus(ctx, runID)
		}
		return "RUNNING", nil
	}
	if eng, err := e.runner.registry.Get(engineName); err == nil {
		return eng.GetStatus(ctx, runID)
	}
	return "UNKNOWN", nil
}
