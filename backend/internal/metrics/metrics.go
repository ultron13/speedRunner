package metrics

import (
	"fmt"
	"net/http"
	"sync"
	"time"
)

type Metrics struct {
	mu sync.RWMutex

	// Run metrics
	RunsTotal        map[string]int64 // by status
	RunDuration      []float64
	ActiveVUsers     int64
	ActiveRuns       int64

	// API metrics
	APIRequestsTotal int64
	APIRequestErrors int64

	// Engine metrics
	EnginePodsActive int64
	EnginePodsTotal  int64

	// Timestamps
	StartTime time.Time
}

var (
	globalMetrics *Metrics
	once          sync.Once
)

func GetMetrics() *Metrics {
	once.Do(func() {
		globalMetrics = &Metrics{
			RunsTotal:  make(map[string]int64),
			StartTime:  time.Now(),
		}
	})
	return globalMetrics
}

func (m *Metrics) RecordRun(status string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.RunsTotal[status]++
}

func (m *Metrics) RecordRunDuration(duration float64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.RunDuration = append(m.RunDuration, duration)
	if len(m.RunDuration) > 1000 {
		m.RunDuration = m.RunDuration[len(m.RunDuration)-1000:]
	}
}

func (m *Metrics) SetActiveRuns(n int64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.ActiveRuns = n
}

func (m *Metrics) IncrementAPIRequests() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.APIRequestsTotal++
}

func (m *Metrics) IncrementAPIErrors() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.APIRequestErrors++
}

func (m *Metrics) Snapshot() map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()

	avgDuration := float64(0)
	if len(m.RunDuration) > 0 {
		total := float64(0)
		for _, d := range m.RunDuration {
			total += d
		}
		avgDuration = total / float64(len(m.RunDuration))
	}

	return map[string]interface{}{
		"uptime_seconds":     time.Since(m.StartTime).Seconds(),
		"runs_total":         m.RunsTotal,
		"avg_run_duration":   avgDuration,
		"active_runs":        m.ActiveRuns,
		"active_v_users":     m.ActiveVUsers,
		"api_requests_total": m.APIRequestsTotal,
		"api_errors_total":   m.APIRequestErrors,
		"engine_pods_active": m.EnginePodsActive,
	}
}

// PrometheusHandler returns a simple Prometheus-compatible metrics endpoint
func PrometheusHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		m := GetMetrics()
		snapshot := m.Snapshot()

		w.Header().Set("Content-Type", "text/plain; version=0.0.4")
		fmt.Fprintf(w, "# HELP speedrunner_uptime_seconds Time since server start\n")
		fmt.Fprintf(w, "# TYPE speedrunner_uptime_seconds gauge\n")
		fmt.Fprintf(w, "speedrunner_uptime_seconds %.2f\n", snapshot["uptime_seconds"])

		fmt.Fprintf(w, "# HELP speedrunner_active_runs Number of active test runs\n")
		fmt.Fprintf(w, "# TYPE speedrunner_active_runs gauge\n")
		fmt.Fprintf(w, "speedrunner_active_runs %d\n", snapshot["active_runs"])

		fmt.Fprintf(w, "# HELP speedrunner_active_v_users Active virtual users\n")
		fmt.Fprintf(w, "# TYPE speedrunner_active_v_users gauge\n")
		fmt.Fprintf(w, "speedrunner_active_v_users %d\n", snapshot["active_v_users"])

		fmt.Fprintf(w, "# HELP speedrunner_api_requests_total Total API requests\n")
		fmt.Fprintf(w, "# TYPE speedrunner_api_requests_total counter\n")
		fmt.Fprintf(w, "speedrunner_api_requests_total %d\n", snapshot["api_requests_total"])

		fmt.Fprintf(w, "# HELP speedrunner_api_errors_total Total API errors\n")
		fmt.Fprintf(w, "# TYPE speedrunner_api_errors_total counter\n")
		fmt.Fprintf(w, "speedrunner_api_errors_total %d\n", snapshot["api_errors_total"])

		fmt.Fprintf(w, "# HELP speedrunner_avg_run_duration Average run duration in seconds\n")
		fmt.Fprintf(w, "# TYPE speedrunner_avg_run_duration gauge\n")
		fmt.Fprintf(w, "speedrunner_avg_run_duration %.2f\n", snapshot["avg_run_duration"])

		for status, count := range m.RunsTotal {
			fmt.Fprintf(w, "# HELP speedrunner_runs_total Total runs by status\n")
			fmt.Fprintf(w, "# TYPE speedrunner_runs_total counter\n")
			fmt.Fprintf(w, "speedrunner_runs_total{status=\"%s\"} %d\n", status, count)
		}
	}
}
