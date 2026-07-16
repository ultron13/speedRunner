package queries

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Run struct {
	ID              string     `json:"id"`
	TestID          string     `json:"test_id"`
	Status          string     `json:"status"`
	StartedAt       time.Time  `json:"started_at"`
	CompletedAt     *time.Time `json:"completed_at,omitempty"`
	Duration        *float64   `json:"duration,omitempty"`
	Throughput      *float64   `json:"throughput,omitempty"`
	AvgResponseTime *float64   `json:"avg_response_time,omitempty"`
	P50             *float64   `json:"p50,omitempty"`
	P90             *float64   `json:"p90,omitempty"`
	P95             *float64   `json:"p95,omitempty"`
	P99             *float64   `json:"p99,omitempty"`
	ErrorRate       *float64   `json:"error_rate,omitempty"`
	TriggeredBy     *string    `json:"triggered_by,omitempty"`
	TriggerType     string     `json:"trigger_type"`
}

type RunMetric struct {
	ID              string    `json:"id"`
	RunID           string    `json:"run_id"`
	Timestamp       time.Time `json:"timestamp"`
	Duration        float64   `json:"duration"`
	Throughput      float64   `json:"throughput"`
	AvgResponseTime float64   `json:"avg_response_time"`
	ErrorRate       float64   `json:"error_rate"`
	ActiveVUsers    int       `json:"active_v_users"`
}

type RunQueries struct {
	pool *pgxpool.Pool
}

func NewRunQueries(pool *pgxpool.Pool) *RunQueries {
	return &RunQueries{pool: pool}
}

func (q *RunQueries) List(ctx context.Context, testID string) ([]Run, error) {
	var rows pgxRows
	var err error
	if testID != "" {
		rows, err = q.pool.Query(ctx, "SELECT id, test_id, status, started_at, completed_at, duration, throughput, avg_response_time, p50, p90, p95, p99, error_rate, triggered_by, trigger_type FROM runs WHERE test_id=$1 ORDER BY started_at DESC", testID)
	} else {
		rows, err = q.pool.Query(ctx, "SELECT id, test_id, status, started_at, completed_at, duration, throughput, avg_response_time, p50, p90, p95, p99, error_rate, triggered_by, trigger_type FROM runs ORDER BY started_at DESC LIMIT 100")
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var runs []Run
	for rows.Next() {
		var r Run
		if err := rows.Scan(&r.ID, &r.TestID, &r.Status, &r.StartedAt, &r.CompletedAt, &r.Duration, &r.Throughput, &r.AvgResponseTime, &r.P50, &r.P90, &r.P95, &r.P99, &r.ErrorRate, &r.TriggeredBy, &r.TriggerType); err != nil {
			return nil, err
		}
		runs = append(runs, r)
	}
	return runs, nil
}

func (q *RunQueries) Get(ctx context.Context, id string) (*Run, error) {
	var r Run
	err := q.pool.QueryRow(ctx, "SELECT id, test_id, status, started_at, completed_at, duration, throughput, avg_response_time, p50, p90, p95, p99, error_rate, triggered_by, trigger_type FROM runs WHERE id=$1", id).
		Scan(&r.ID, &r.TestID, &r.Status, &r.StartedAt, &r.CompletedAt, &r.Duration, &r.Throughput, &r.AvgResponseTime, &r.P50, &r.P90, &r.P95, &r.P99, &r.ErrorRate, &r.TriggeredBy, &r.TriggerType)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

func (q *RunQueries) Create(ctx context.Context, id, testID, triggerType string, triggeredBy *string) (*Run, error) {
	var r Run
	err := q.pool.QueryRow(ctx,
		"INSERT INTO runs (id, test_id, trigger_type, triggered_by) VALUES ($1, $2, $3, $4) RETURNING id, test_id, status, started_at, completed_at, duration, throughput, avg_response_time, p50, p90, p95, p99, error_rate, triggered_by, trigger_type",
		id, testID, triggerType, triggeredBy,
	).Scan(&r.ID, &r.TestID, &r.Status, &r.StartedAt, &r.CompletedAt, &r.Duration, &r.Throughput, &r.AvgResponseTime, &r.P50, &r.P90, &r.P95, &r.P99, &r.ErrorRate, &r.TriggeredBy, &r.TriggerType)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

func (q *RunQueries) Complete(ctx context.Context, id string, status string, duration, throughput, avgRT, p50, p90, p95, p99, errorRate float64) error {
	_, err := q.pool.Exec(ctx,
		`UPDATE runs SET status=$2, completed_at=NOW(), duration=$3, throughput=$4, avg_response_time=$5, p50=$6, p90=$7, p95=$8, p99=$9, error_rate=$10 WHERE id=$1`,
		id, status, duration, throughput, avgRT, p50, p90, p95, p99, errorRate,
	)
	return err
}

func (q *RunQueries) Stop(ctx context.Context, id string) error {
	_, err := q.pool.Exec(ctx, "UPDATE runs SET status='STOPPED', completed_at=NOW() WHERE id=$1", id)
	return err
}

func (q *RunQueries) AddMetric(ctx context.Context, runID string, duration, throughput, avgRT, errorRate float64, activeVUs int) error {
	_, err := q.pool.Exec(ctx,
		"INSERT INTO run_metrics (id, run_id, duration, throughput, avg_response_time, error_rate, active_v_users) VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6)",
		runID, duration, throughput, avgRT, errorRate, activeVUs,
	)
	return err
}

func (q *RunQueries) GetMetrics(ctx context.Context, runID string) ([]RunMetric, error) {
	rows, err := q.pool.Query(ctx, "SELECT id, run_id, timestamp, duration, throughput, avg_response_time, error_rate, active_v_users FROM run_metrics WHERE run_id=$1 ORDER BY timestamp", runID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var metrics []RunMetric
	for rows.Next() {
		var m RunMetric
		if err := rows.Scan(&m.ID, &m.RunID, &m.Timestamp, &m.Duration, &m.Throughput, &m.AvgResponseTime, &m.ErrorRate, &m.ActiveVUsers); err != nil {
			return nil, err
		}
		metrics = append(metrics, m)
	}
	return metrics, nil
}
