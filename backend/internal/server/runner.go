package server

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/belo/speedrunner/backend/internal/db/queries"
	"github.com/belo/speedrunner/backend/internal/engine"
	"github.com/belo/speedrunner/backend/internal/engine/gatling"
	"github.com/belo/speedrunner/backend/internal/engine/httpengine"
	"github.com/belo/speedrunner/backend/internal/engine/jmeter"
	"github.com/belo/speedrunner/backend/internal/engine/k6"
	"github.com/belo/speedrunner/backend/internal/engine/locust"
	"github.com/belo/speedrunner/backend/internal/engine/playwright"
	"github.com/belo/speedrunner/backend/internal/engine/simulate"
	"github.com/belo/speedrunner/backend/internal/integrations"
	k8sclient "github.com/belo/speedrunner/backend/internal/k8s"
	"github.com/belo/speedrunner/backend/internal/platform"
	redisclient "github.com/belo/speedrunner/backend/internal/redis"
	"github.com/belo/speedrunner/backend/internal/storage"
	"github.com/belo/speedrunner/backend/internal/telemetry"
)

// RunnerOrchestrator routes runs to simulate / HTTP / JMeter / k6 engines.
type RunnerOrchestrator struct {
	mode     string // simulate | http | jmeter | k6 | auto
	sim      *simulate.Engine
	httpEng  *httpengine.Engine
	registry *engine.Registry
	k8s      *k8sclient.Client
	runs     *queries.RunQueries
	tests    *queries.TestQueries
	sla      *queries.SLAQueries
	redis     *redisclient.RedisClient
	webhooks  *integrations.Dispatcher
	storage   storage.ObjectStorage
	artifacts *queries.ArtifactQueries
	artifactMeta *platform.ArtifactStore
	mu        sync.Mutex
	runMeta   map[string]runMeta
}

type runMeta struct {
	testID     string
	projectID  string
	vus        int
	engineName string
	startedAt  time.Time
}

// RunnerConfig configures the orchestrator.
type RunnerConfig struct {
	Mode        string
	K8s         *k8sclient.Client
	Namespace   string
	JMeterImage string
	K6Image     string
	Runs        *queries.RunQueries
	Tests       *queries.TestQueries
	SLA         *queries.SLAQueries
	Redis        *redisclient.RedisClient
	Webhooks     *integrations.Dispatcher
	Storage      storage.ObjectStorage
	Artifacts    *queries.ArtifactQueries
	ArtifactMeta *platform.ArtifactStore
}

func NewRunnerOrchestrator(cfg RunnerConfig) *RunnerOrchestrator {
	mode := strings.ToLower(strings.TrimSpace(cfg.Mode))
	if mode == "" {
		mode = "simulate"
	}

	o := &RunnerOrchestrator{
		mode:         mode,
		runs:         cfg.Runs,
		tests:        cfg.Tests,
		sla:          cfg.SLA,
		redis:        cfg.Redis,
		webhooks:     cfg.Webhooks,
		storage:      cfg.Storage,
		artifacts:    cfg.Artifacts,
		artifactMeta: cfg.ArtifactMeta,
		k8s:          cfg.K8s,
		runMeta:      make(map[string]runMeta),
		registry:     engine.NewRegistry(),
		httpEng:      httpengine.New(),
	}
	o.sim = simulate.New(o.onTick)
	o.registry.Register(o.sim)
	o.registry.Register(o.httpEng)

	if cfg.K8s != nil {
		ns := cfg.Namespace
		if ns == "" {
			ns = cfg.K8s.Namespace
		}
		jmImage := cfg.JMeterImage
		if jmImage == "" {
			jmImage = "apache/jmeter:5.6.3"
		}
		k6Image := cfg.K6Image
		if k6Image == "" {
			k6Image = "grafana/k6:latest"
		}
		cs := cfg.K8s.Clientset
		o.registry.Register(jmeter.New(cs, ns, jmImage))
		o.registry.Register(k6.New(cs, ns, k6Image))
		o.registry.Register(gatling.New(cs, ns, ""))
		o.registry.Register(locust.New(cs, ns, ""))
		o.registry.Register(playwright.New(cs, ns, ""))
		log.Printf("[runner] k8s engines registered (ns=%s): jmeter,k6,gatling,locust,playwright", ns)
	}

	log.Printf("[runner] mode=%s engines=%v", mode, o.registry.List())
	return o
}

func (o *RunnerOrchestrator) Engine() *simulate.Engine {
	return o.sim
}

func (o *RunnerOrchestrator) Mode() string {
	return o.mode
}

func (o *RunnerOrchestrator) Engines() []string {
	return o.registry.List()
}

func (o *RunnerOrchestrator) HasK8s() bool {
	return o.k8s != nil
}

func (o *RunnerOrchestrator) onTick(runID string, m simulate.LiveMetrics) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if o.runs != nil {
		_ = o.runs.AddMetric(ctx, runID, m.Duration, m.Throughput, m.AvgResponseTime, m.ErrorRate, m.ActiveVUsers)
	}
	if o.redis != nil {
		payload, _ := json.Marshal(map[string]interface{}{
			"duration":        m.Duration,
			"throughput":      m.Throughput,
			"avgResponseTime": m.AvgResponseTime,
			"errorRate":       m.ErrorRate,
			"activeVUsers":    m.ActiveVUsers,
			"p50":             m.P50,
			"p90":             m.P90,
			"p95":             m.P95,
			"p99":             m.P99,
		})
		_ = o.redis.Set(ctx, redisclient.RunMetricsKey(runID), string(payload), 24*time.Hour)
		_ = o.redis.Publish(ctx, "speedrunner:metrics", fmt.Sprintf(`{"runId":%q,"metrics":%s}`, runID, payload))
	}
}

// resolveEngine picks the execution backend for a test.
func (o *RunnerOrchestrator) resolveEngine(scriptType string) string {
	st := strings.ToUpper(strings.TrimSpace(scriptType))
	switch o.mode {
	case "simulate", "http", "jmeter", "k6":
		// Explicit mode wins, but fall back if unavailable
		if o.mode == "jmeter" || o.mode == "k6" {
			if _, err := o.registry.Get(o.mode); err != nil {
				log.Printf("[runner] engine %s unavailable, falling back to simulate", o.mode)
				return "simulate"
			}
		}
		if o.mode == "http" {
			return "http"
		}
		if o.mode == "simulate" {
			return "simulate"
		}
		return o.mode
	case "auto":
		switch st {
		case "JMETER":
			if _, err := o.registry.Get("jmeter"); err == nil {
				return "jmeter"
			}
			return "simulate"
		case "K6":
			if _, err := o.registry.Get("k6"); err == nil {
				return "k6"
			}
			return "simulate"
		case "GATLING":
			if _, err := o.registry.Get("gatling"); err == nil {
				return "gatling"
			}
			return "simulate"
		case "LOCUST":
			if _, err := o.registry.Get("locust"); err == nil {
				return "locust"
			}
			return "simulate"
		case "PLAYWRIGHT", "TRUCLIENT":
			if _, err := o.registry.Get("playwright"); err == nil {
				return "playwright"
			}
			return "http"
		case "HTTP":
			return "http"
		default:
			return "simulate"
		}
	default:
		return "simulate"
	}
}

// Start begins execution for a run.
func (o *RunnerOrchestrator) Start(ctx context.Context, runID string, test *queries.Test) error {
	engineName := o.resolveEngine(test.ScriptType)
	meta := runMeta{
		testID:     test.ID,
		projectID:  test.ProjectID,
		vus:        test.VirtualUsers,
		engineName: engineName,
		startedAt:  time.Now(),
	}
	o.mu.Lock()
	o.runMeta[runID] = meta
	o.mu.Unlock()

	_ = telemetry.ForRun(runID, test.ID, test.ProjectID)

	// Ensure execution namespace exists when using K8s engines
	if (engineName == "jmeter" || engineName == "k6") && o.k8s != nil {
		if err := o.k8s.EnsureNamespace(ctx, o.k8s.Namespace); err != nil {
			log.Printf("[runner] ensure namespace: %v", err)
		}
	}

	duration := 300 // default 5 min for k8s jobs
	if engineName == "simulate" || engineName == "http" {
		duration = 3600
	}
	rampUp := duration / 10
	if rampUp < 10 {
		rampUp = 10
	}

	req := engine.ExecutionRequest{
		RunID:        runID,
		TestID:       test.ID,
		TargetURL:    test.TargetURL,
		VirtualUsers: test.VirtualUsers,
		Duration:     duration,
		RampUp:       rampUp,
		Namespace:    "",
		Labels: map[string]string{
			"run_id":      sanitizeLabel(runID),
			"test_id":     sanitizeLabel(test.ID),
			"project_id":  sanitizeLabel(test.ProjectID),
			"script_type": sanitizeLabel(test.ScriptType),
			"engine":      engineName,
		},
	}
	if o.k8s != nil {
		req.Namespace = o.k8s.Namespace
	}

	eng, err := o.registry.Get(engineName)
	if err != nil {
		// Last-resort simulate
		eng = o.sim
		engineName = "simulate"
		meta.engineName = engineName
		o.mu.Lock()
		o.runMeta[runID] = meta
		o.mu.Unlock()
	}

	// For K8s engines, also start local sim for live metric streaming
	// (jobs do not emit continuous metrics until result collection is wired)
	if engineName == "jmeter" || engineName == "k6" || engineName == "gatling" ||
		engineName == "locust" || engineName == "playwright" {
		if _, err := o.sim.Execute(ctx, req); err != nil {
			log.Printf("[runner] sim companion start: %v", err)
		}
	}

	if _, err := eng.Execute(ctx, req); err != nil {
		// Cleanup companion sim on failure
		_ = o.sim.Cleanup(ctx, runID)
		return fmt.Errorf("engine %s: %w", engineName, err)
	}

	if o.redis != nil {
		_ = o.redis.Set(ctx, redisclient.RunStatusKey(runID), "RUNNING", 24*time.Hour)
		_ = o.redis.HSet(ctx, redisclient.RunKey(runID),
			"engine", engineName,
			"testId", test.ID,
			"status", "RUNNING",
		)
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
				"engine":       engineName,
				"mode":         o.mode,
			},
		})
	}

	// Watch K8s job completion in background
	if engineName == "jmeter" || engineName == "k6" || engineName == "gatling" ||
		engineName == "locust" || engineName == "playwright" {
		go o.watchJob(runID, engineName, time.Duration(duration+120)*time.Second)
	}

	log.Printf("[runner] started run=%s engine=%s test=%s vus=%d", runID, engineName, test.ID, test.VirtualUsers)
	return nil
}

func (o *RunnerOrchestrator) watchJob(runID, engineName string, timeout time.Duration) {
	eng, err := o.registry.Get(engineName)
	if err != nil {
		return
	}
	deadline := time.Now().Add(timeout)
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for time.Now().Before(deadline) {
		<-ticker.C
		// Stop watching if run was already stopped externally
		o.mu.Lock()
		_, stillActive := o.runMeta[runID]
		o.mu.Unlock()
		if !stillActive {
			return
		}

		st, err := eng.GetStatus(context.Background(), runID)
		if err != nil {
			log.Printf("[runner] job status %s: %v", runID, err)
			continue
		}
		switch st {
		case "COMPLETED", "FAILED":
			ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			_ = o.Stop(ctx, runID, st)
			if o.runs != nil && o.tests != nil {
				if run, err := o.runs.Get(ctx, runID); err == nil && run != nil {
					_ = o.tests.UpdateStatus(ctx, run.TestID, st)
				}
			}
			cancel()
			return
		}
	}
	log.Printf("[runner] job watch timeout run=%s", runID)
}

// Stop ends execution, finalizes metrics, evaluates SLA.
func (o *RunnerOrchestrator) Stop(ctx context.Context, runID, status string) error {
	o.mu.Lock()
	meta, hasMeta := o.runMeta[runID]
	delete(o.runMeta, runID)
	o.mu.Unlock()

	snap, ok := o.sim.Snapshot(runID)
	_ = o.sim.Cleanup(ctx, runID)

	// Cleanup primary engine
	if hasMeta && meta.engineName != "" && meta.engineName != "simulate" {
		if eng, err := o.registry.Get(meta.engineName); err == nil {
			_ = eng.Cleanup(ctx, runID)
		}
	}

	if ok && o.runs != nil {
		if err := o.runs.Complete(ctx, runID, status,
			snap.Duration, snap.Throughput, snap.AvgResponseTime,
			snap.P50, snap.P90, snap.P95, snap.P99, snap.ErrorRate,
		); err != nil {
			_ = o.runs.Stop(ctx, runID)
		}
	} else if o.runs != nil {
		_ = o.runs.Stop(ctx, runID)
	}

	if o.redis != nil {
		_ = o.redis.Set(ctx, redisclient.RunStatusKey(runID), status, 24*time.Hour)
	}

	if hasMeta && o.sla != nil && o.runs != nil && ok {
		o.evaluateSLA(ctx, runID, meta.projectID, snap)
	}

	// Persist run summary artifact (vertical slice: metrics → artifacts)
	if ok {
		o.persistRunArtifact(ctx, runID, meta, status, snap)
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
				"engine":          meta.engineName,
				"duration":        snap.Duration,
				"throughput":      snap.Throughput,
				"avgResponseTime": snap.AvgResponseTime,
				"errorRate":       snap.ErrorRate,
			},
		})
	}
	return nil
}

func (o *RunnerOrchestrator) persistRunArtifact(ctx context.Context, runID string, meta runMeta, status string, snap simulate.LiveMetrics) {
	summary := map[string]interface{}{
		"runId":           runID,
		"testId":          meta.testID,
		"projectId":       meta.projectID,
		"status":          status,
		"engine":          meta.engineName,
		"startedAt":       meta.startedAt.UTC().Format(time.RFC3339),
		"completedAt":     time.Now().UTC().Format(time.RFC3339),
		"duration":        snap.Duration,
		"throughput":      snap.Throughput,
		"avgResponseTime": snap.AvgResponseTime,
		"p50":             snap.P50,
		"p90":             snap.P90,
		"p95":             snap.P95,
		"p99":             snap.P99,
		"errorRate":       snap.ErrorRate,
		"activeVUsers":    snap.ActiveVUsers,
	}
	body, err := json.MarshalIndent(summary, "", "  ")
	if err != nil {
		return
	}
	objectKey := fmt.Sprintf("runs/%s/summary.json", runID)
	bucket := storage.BucketResults
	if o.storage != nil {
		if err := o.storage.Put(ctx, bucket, objectKey, bytes.NewReader(body), "application/json"); err != nil {
			log.Printf("[runner] artifact put run=%s: %v", runID, err)
		} else {
			log.Printf("[runner] artifact stored run=%s key=%s", runID, objectKey)
		}
	}
	artID := uuid.New().String()
	if o.artifacts != nil {
		_, err := o.artifacts.Create(ctx, &queries.Artifact{
			ID: artID, RunID: runID, Name: "run-summary.json", Kind: "summary",
			ContentType: "application/json", SizeBytes: int64(len(body)),
			Bucket: bucket, ObjectKey: objectKey,
			URL: fmt.Sprintf("/api/artifacts/content?runId=%s&key=%s", url.QueryEscape(runID), url.QueryEscape(objectKey)),
		})
		if err != nil {
			log.Printf("[runner] artifact db run=%s: %v", runID, err)
		}
	}
	if o.artifactMeta != nil {
		o.artifactMeta.Put(&platform.Artifact{
			ID: artID, RunID: runID, Name: "run-summary.json", Type: "report",
			SizeBytes: int64(len(body)), URI: objectKey,
		})
	}
}

// LiveSnapshot returns the latest metrics for a run (for API polling).
func (o *RunnerOrchestrator) LiveSnapshot(runID string) (simulate.LiveMetrics, bool) {
	return o.sim.Snapshot(runID)
}

// ActiveRunIDs returns currently executing run IDs.
func (o *RunnerOrchestrator) ActiveRunIDs() []string {
	o.mu.Lock()
	defer o.mu.Unlock()
	ids := make([]string, 0, len(o.runMeta))
	for id := range o.runMeta {
		ids = append(ids, id)
	}
	return ids
}

// RunInfo returns engine/meta for a run if active.
func (o *RunnerOrchestrator) RunInfo(runID string) (runMeta, bool) {
	o.mu.Lock()
	defer o.mu.Unlock()
	m, ok := o.runMeta[runID]
	return m, ok
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
		case "avg_response_time", "response_time", "avgresponsetime":
			actual = snap.AvgResponseTime
		case "error_rate", "errorrate":
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
	switch strings.ToUpper(frequency) {
	case "HOURLY":
		return from.Add(time.Hour)
	case "DAILY":
		return from.Add(24 * time.Hour)
	case "WEEKLY":
		return from.Add(7 * 24 * time.Hour)
	case "MONTHLY":
		return from.AddDate(0, 1, 0)
	case "ONCE":
		return from.Add(100 * 365 * 24 * time.Hour)
	default:
		return from.Add(24 * time.Hour)
	}
}

func sanitizeLabel(s string) string {
	s = strings.ToLower(s)
	var b strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' || r == '_' || r == '.' {
			b.WriteRune(r)
		} else {
			b.WriteByte('-')
		}
	}
	out := b.String()
	if len(out) > 63 {
		out = out[:63]
	}
	return out
}

// ParseTargetURL splits a URL for JMeter domain/path (exported for tests/helpers).
func ParseTargetURL(raw string) (domain, path, protocol string) {
	protocol = "https"
	path = "/"
	domain = raw
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" {
		// Maybe missing scheme
		u, err = url.Parse("https://" + raw)
		if err != nil {
			return raw, "/", "https"
		}
	}
	if u.Scheme != "" {
		protocol = u.Scheme
	}
	domain = u.Hostname()
	if u.Port() != "" {
		domain = domain + ":" + u.Port()
	}
	if u.Path != "" {
		path = u.Path
	}
	if u.RawQuery != "" {
		path = path + "?" + u.RawQuery
	}
	return domain, path, protocol
}
