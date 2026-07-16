package server

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/belo/speedrunner/backend/internal/db/queries"
	"github.com/belo/speedrunner/backend/internal/engine"
	"github.com/belo/speedrunner/backend/internal/engine/simulate"
	"github.com/belo/speedrunner/backend/internal/integrations"
	redisclient "github.com/belo/speedrunner/backend/internal/redis"
	"github.com/belo/speedrunner/backend/internal/telemetry"
)

// RunnerOrchestrator starts/stops simulated runs and persists metrics.
type RunnerOrchestrator struct {
	sim      *simulate.Engine
	runs     *queries.RunQueries
	tests    *queries.TestQueries
	sla      *queries.SLAQueries
	redis    *redisclient.RedisClient
	webhooks *integrations.Dispatcher
	mu       sync.Mutex
	// runMeta maps runID -> test metadata for SLA evaluation on stop
	runMeta map[string]runMeta
}

type runMeta struct {
	testID    string
	projectID string
	vus       int
}

func NewRunnerOrchestrator(
	runs *queries.RunQueries,
	tests *queries.TestQueries,
	sla *queries.SLAQueries,
	redis *redisclient.RedisClient,
	webhooks *integrations.Dispatcher,
) *RunnerOrchestrator {
	o := &RunnerOrchestrator{
		runs:     runs,
		tests:    tests,
		sla:      sla,
		redis:    redis,
		webhooks: webhooks,
		runMeta:  make(map[string]runMeta),
	}
	o.sim = simulate.New(o.onTick)
	return o
}

func (o *RunnerOrchestrator) Engine() *simulate.Engine {
	return o.sim
}

func (o *RunnerOrchestrator) onTick(runID string, m simulate.LiveMetrics) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if o.runs != nil {
		_ = o.runs.AddMetric(ctx, runID, m.Duration, m.Throughput, m.AvgResponseTime, m.ErrorRate, m.ActiveVUsers)
	}
	if o.redis != nil {
		payload, _ := json.Marshal(m)
		_ = o.redis.Set(ctx, redisclient.RunMetricsKey(runID), string(payload), 24*time.Hour)
		_ = o.redis.Publish(ctx, "speedrunner:metrics", fmt.Sprintf(`{"runId":%q,"metrics":%s}`, runID, payload))
	}
}

// Start begins simulation for a run.
func (o *RunnerOrchestrator) Start(ctx context.Context, runID string, test *queries.Test) error {
	meta := runMeta{testID: test.ID, projectID: test.ProjectID, vus: test.VirtualUsers}
	o.mu.Lock()
	o.runMeta[runID] = meta
	o.mu.Unlock()

	corr := telemetry.ForRun(runID, test.ID, test.ProjectID)
	_ = corr // available for future OTEL export

	req := engine.ExecutionRequest{
		RunID:        runID,
		TestID:       test.ID,
		TargetURL:    test.TargetURL,
		VirtualUsers: test.VirtualUsers,
		Duration:     3600, // max; stop is explicit
		Labels: map[string]string{
			"run_id":  runID,
			"test_id": test.ID,
		},
	}
	if _, err := o.sim.Execute(ctx, req); err != nil {
		return err
	}
	if o.redis != nil {
		_ = o.redis.Set(ctx, redisclient.RunStatusKey(runID), "RUNNING", 24*time.Hour)
	}
	if o.webhooks != nil {
		o.webhooks.Publish(ctx, integrations.EventPayload{
			Event:     integrations.EventRunStarted,
			RunID:     runID,
			TestID:    test.ID,
			ProjectID: test.ProjectID,
			Data: map[string]interface{}{
				"virtualUsers": test.VirtualUsers,
				"scriptType":   test.ScriptType,
			},
		})
	}
	return nil
}

// Stop ends simulation, finalizes metrics, evaluates SLA.
func (o *RunnerOrchestrator) Stop(ctx context.Context, runID, status string) error {
	snap, ok := o.sim.Snapshot(runID)
	_ = o.sim.Cleanup(ctx, runID)

	o.mu.Lock()
	meta, hasMeta := o.runMeta[runID]
	delete(o.runMeta, runID)
	o.mu.Unlock()

	if ok && o.runs != nil {
		if err := o.runs.Complete(ctx, runID, status,
			snap.Duration, snap.Throughput, snap.AvgResponseTime,
			snap.P50, snap.P90, snap.P95, snap.P99, snap.ErrorRate,
		); err != nil {
			// Fallback to simple stop if Complete fails (e.g. already stopped)
			_ = o.runs.Stop(ctx, runID)
		}
	} else if o.runs != nil {
		_ = o.runs.Stop(ctx, runID)
	}

	if o.redis != nil {
		_ = o.redis.Set(ctx, redisclient.RunStatusKey(runID), status, 24*time.Hour)
	}

	// SLA evaluation
	if hasMeta && o.sla != nil && o.runs != nil && ok {
		o.evaluateSLA(ctx, runID, meta.projectID, snap)
	}

	if o.webhooks != nil {
		ev := integrations.EventRunStopped
		if status == "COMPLETED" {
			ev = integrations.EventRunCompleted
		} else if status == "FAILED" {
			ev = integrations.EventRunFailed
		}
		o.webhooks.Publish(ctx, integrations.EventPayload{
			Event:  ev,
			RunID:  runID,
			TestID: meta.testID,
			Data: map[string]interface{}{
				"status":          status,
				"duration":        snap.Duration,
				"throughput":      snap.Throughput,
				"avgResponseTime": snap.AvgResponseTime,
				"errorRate":       snap.ErrorRate,
			},
		})
	}
	return nil
}

func (o *RunnerOrchestrator) evaluateSLA(ctx context.Context, runID, projectID string, snap simulate.LiveMetrics) {
	thresholds, err := o.sla.ListEnabledForProject(ctx, projectID)
	if err != nil {
		log.Printf("[runner] sla list: %v", err)
		return
	}
	for _, t := range thresholds {
		var actual float64
		switch normalizeMetric(t.Metric) {
		case "avg_response_time", "response_time":
			actual = snap.AvgResponseTime
		case "error_rate":
			actual = snap.ErrorRate
		case "throughput":
			actual = snap.Throughput
		case "p50":
			actual = snap.P50
		case "p90":
			actual = snap.P90
		case "p95":
			actual = snap.P95
		case "p99":
			actual = snap.P99
		default:
			continue
		}
		passed := queries.EvaluateSLA(t.Condition, t.Value, actual)
		if err := o.sla.CreateResult(ctx, uuid.New().String(), runID, t.ID, actual, passed); err != nil {
			log.Printf("[runner] sla result: %v", err)
		}
		if !passed && o.webhooks != nil {
			o.webhooks.Publish(ctx, integrations.EventPayload{
				Event: integrations.EventSLABreach,
				RunID: runID,
				Data: map[string]interface{}{
					"threshold": t.Name,
					"metric":    t.Metric,
					"expected":  t.Value,
					"actual":    actual,
				},
			})
		}
	}
}

func normalizeMetric(m string) string {
	out := make([]byte, 0, len(m))
	for i := 0; i < len(m); i++ {
		c := m[i]
		if c >= 'A' && c <= 'Z' {
			c += 'a' - 'A'
		}
		if c == '-' {
			c = '_'
		}
		out = append(out, c)
	}
	return string(out)
}

// ScheduleNextRun computes next fire time from frequency.
func ScheduleNextRun(frequency string, from time.Time) time.Time {
	switch frequency {
	case "HOURLY":
		return from.Add(time.Hour)
	case "DAILY":
		return from.Add(24 * time.Hour)
	case "WEEKLY":
		return from.Add(7 * 24 * time.Hour)
	case "MONTHLY":
		return from.AddDate(0, 1, 0)
	case "ONCE":
		return from.Add(100 * 365 * 24 * time.Hour) // effectively never again
	default:
		return from.Add(24 * time.Hour)
	}
}
