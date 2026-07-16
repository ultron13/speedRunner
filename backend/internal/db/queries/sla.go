package queries

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type SLAThreshold struct {
	ID        string  `json:"id"`
	ProjectID string  `json:"projectId"`
	Name      string  `json:"name"`
	Metric    string  `json:"metric"`
	Condition string  `json:"condition"`
	Value     float64 `json:"value"`
	Enabled   bool    `json:"enabled"`
}

type SLAResult struct {
	ID          string  `json:"id"`
	RunID       string  `json:"runId"`
	ThresholdID string  `json:"thresholdId"`
	ActualValue float64 `json:"actualValue"`
	Passed      bool    `json:"passed"`
}

type SLAResultWithDetails struct {
	SLAResult
	ThresholdName string `json:"thresholdName"`
	Metric        string `json:"metric"`
}

type SLAQueries struct {
	pool *pgxpool.Pool
}

func NewSLAQueries(pool *pgxpool.Pool) *SLAQueries {
	return &SLAQueries{pool: pool}
}

func (q *SLAQueries) ListThresholds(ctx context.Context, projectID string) ([]SLAThreshold, error) {
	var rows pgx.Rows
	var err error
	if projectID != "" {
		rows, err = q.pool.Query(ctx,
			`SELECT id, project_id, name, metric, condition, value, enabled
			 FROM sla_thresholds WHERE project_id=$1 ORDER BY name`, projectID)
	} else {
		rows, err = q.pool.Query(ctx,
			`SELECT id, project_id, name, metric, condition, value, enabled
			 FROM sla_thresholds ORDER BY name`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]SLAThreshold, 0)
	for rows.Next() {
		var t SLAThreshold
		if err := rows.Scan(&t.ID, &t.ProjectID, &t.Name, &t.Metric, &t.Condition, &t.Value, &t.Enabled); err != nil {
			return nil, err
		}
		list = append(list, t)
	}
	return list, rows.Err()
}

func (q *SLAQueries) GetThreshold(ctx context.Context, id string) (*SLAThreshold, error) {
	var t SLAThreshold
	err := q.pool.QueryRow(ctx,
		`SELECT id, project_id, name, metric, condition, value, enabled
		 FROM sla_thresholds WHERE id=$1`, id,
	).Scan(&t.ID, &t.ProjectID, &t.Name, &t.Metric, &t.Condition, &t.Value, &t.Enabled)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &t, nil
}

func (q *SLAQueries) CreateThreshold(ctx context.Context, id, projectID, name, metric, condition string, value float64) (*SLAThreshold, error) {
	var t SLAThreshold
	err := q.pool.QueryRow(ctx,
		`INSERT INTO sla_thresholds (id, project_id, name, metric, condition, value)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, project_id, name, metric, condition, value, enabled`,
		id, projectID, name, metric, condition, value,
	).Scan(&t.ID, &t.ProjectID, &t.Name, &t.Metric, &t.Condition, &t.Value, &t.Enabled)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (q *SLAQueries) DeleteThreshold(ctx context.Context, id string) error {
	_, err := q.pool.Exec(ctx, `DELETE FROM sla_thresholds WHERE id=$1`, id)
	return err
}

func (q *SLAQueries) ListResults(ctx context.Context, runID string, limit int) ([]SLAResultWithDetails, error) {
	if limit <= 0 {
		limit = 100
	}
	var rows pgx.Rows
	var err error
	if runID != "" {
		rows, err = q.pool.Query(ctx,
			`SELECT r.id, r.run_id, r.threshold_id, r.actual_value, r.passed,
			        COALESCE(t.name, ''), COALESCE(t.metric, '')
			 FROM sla_results r
			 LEFT JOIN sla_thresholds t ON t.id = r.threshold_id
			 WHERE r.run_id=$1
			 ORDER BY r.id DESC
			 LIMIT $2`, runID, limit)
	} else {
		rows, err = q.pool.Query(ctx,
			`SELECT r.id, r.run_id, r.threshold_id, r.actual_value, r.passed,
			        COALESCE(t.name, ''), COALESCE(t.metric, '')
			 FROM sla_results r
			 LEFT JOIN sla_thresholds t ON t.id = r.threshold_id
			 ORDER BY r.id DESC
			 LIMIT $1`, limit)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]SLAResultWithDetails, 0)
	for rows.Next() {
		var r SLAResultWithDetails
		if err := rows.Scan(&r.ID, &r.RunID, &r.ThresholdID, &r.ActualValue, &r.Passed,
			&r.ThresholdName, &r.Metric); err != nil {
			return nil, err
		}
		list = append(list, r)
	}
	return list, rows.Err()
}

func (q *SLAQueries) CreateResult(ctx context.Context, id, runID, thresholdID string, actual float64, passed bool) error {
	_, err := q.pool.Exec(ctx,
		`INSERT INTO sla_results (id, run_id, threshold_id, actual_value, passed)
		 VALUES ($1, $2, $3, $4, $5)`, id, runID, thresholdID, actual, passed)
	return err
}

func (q *SLAQueries) ListEnabledForProject(ctx context.Context, projectID string) ([]SLAThreshold, error) {
	rows, err := q.pool.Query(ctx,
		`SELECT id, project_id, name, metric, condition, value, enabled
		 FROM sla_thresholds WHERE project_id=$1 AND enabled=true`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]SLAThreshold, 0)
	for rows.Next() {
		var t SLAThreshold
		if err := rows.Scan(&t.ID, &t.ProjectID, &t.Name, &t.Metric, &t.Condition, &t.Value, &t.Enabled); err != nil {
			return nil, err
		}
		list = append(list, t)
	}
	return list, rows.Err()
}

// Evaluate returns true if the actual value passes the threshold condition.
func EvaluateSLA(condition string, threshold, actual float64) bool {
	switch condition {
	case "lt", "less_than", "<":
		return actual < threshold
	case "lte", "less_than_or_equal", "<=":
		return actual <= threshold
	case "gt", "greater_than", ">":
		return actual > threshold
	case "gte", "greater_than_or_equal", ">=":
		return actual >= threshold
	case "eq", "equal", "==":
		return actual == threshold
	default:
		// Default: actual must be less than or equal to threshold (typical for latency/error)
		return actual <= threshold
	}
}
