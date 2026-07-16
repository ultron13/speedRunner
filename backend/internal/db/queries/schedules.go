package queries

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Schedule struct {
	ID             string     `json:"id"`
	TestID         string     `json:"testId"`
	Name           string     `json:"name"`
	Frequency      string     `json:"frequency"`
	CronExpression *string    `json:"cronExpression,omitempty"`
	Enabled        bool       `json:"enabled"`
	NextRunAt      *time.Time `json:"nextRunAt,omitempty"`
	LastRunAt      *time.Time `json:"lastRunAt,omitempty"`
	CreatedAt      time.Time  `json:"createdAt"`
}

type ScheduleWithTestName struct {
	Schedule
	TestName string `json:"testName"`
}

type ScheduleQueries struct {
	pool *pgxpool.Pool
}

func NewScheduleQueries(pool *pgxpool.Pool) *ScheduleQueries {
	return &ScheduleQueries{pool: pool}
}

func (q *ScheduleQueries) List(ctx context.Context, testID string) ([]ScheduleWithTestName, error) {
	var rows pgx.Rows
	var err error
	if testID != "" {
		rows, err = q.pool.Query(ctx,
			`SELECT s.id, s.test_id, s.name, s.frequency, s.cron_expression, s.enabled,
			        s.next_run_at, s.last_run_at, s.created_at, COALESCE(t.name, '')
			 FROM test_schedules s
			 LEFT JOIN tests t ON t.id = s.test_id
			 WHERE s.test_id=$1
			 ORDER BY s.created_at DESC`, testID)
	} else {
		rows, err = q.pool.Query(ctx,
			`SELECT s.id, s.test_id, s.name, s.frequency, s.cron_expression, s.enabled,
			        s.next_run_at, s.last_run_at, s.created_at, COALESCE(t.name, '')
			 FROM test_schedules s
			 LEFT JOIN tests t ON t.id = s.test_id
			 ORDER BY s.created_at DESC`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]ScheduleWithTestName, 0)
	for rows.Next() {
		var s ScheduleWithTestName
		if err := rows.Scan(&s.ID, &s.TestID, &s.Name, &s.Frequency, &s.CronExpression,
			&s.Enabled, &s.NextRunAt, &s.LastRunAt, &s.CreatedAt, &s.TestName); err != nil {
			return nil, err
		}
		list = append(list, s)
	}
	return list, rows.Err()
}

func (q *ScheduleQueries) Get(ctx context.Context, id string) (*Schedule, error) {
	var s Schedule
	err := q.pool.QueryRow(ctx,
		`SELECT id, test_id, name, frequency, cron_expression, enabled, next_run_at, last_run_at, created_at
		 FROM test_schedules WHERE id=$1`, id,
	).Scan(&s.ID, &s.TestID, &s.Name, &s.Frequency, &s.CronExpression,
		&s.Enabled, &s.NextRunAt, &s.LastRunAt, &s.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &s, nil
}

func (q *ScheduleQueries) Create(ctx context.Context, id, testID, name, frequency string, cronExpr *string, nextRun *time.Time) (*Schedule, error) {
	var s Schedule
	err := q.pool.QueryRow(ctx,
		`INSERT INTO test_schedules (id, test_id, name, frequency, cron_expression, next_run_at)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, test_id, name, frequency, cron_expression, enabled, next_run_at, last_run_at, created_at`,
		id, testID, name, frequency, cronExpr, nextRun,
	).Scan(&s.ID, &s.TestID, &s.Name, &s.Frequency, &s.CronExpression,
		&s.Enabled, &s.NextRunAt, &s.LastRunAt, &s.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (q *ScheduleQueries) Update(ctx context.Context, id, name, frequency string, cronExpr *string, enabled bool, nextRun *time.Time) (*Schedule, error) {
	var s Schedule
	err := q.pool.QueryRow(ctx,
		`UPDATE test_schedules SET name=$2, frequency=$3, cron_expression=$4, enabled=$5, next_run_at=$6
		 WHERE id=$1
		 RETURNING id, test_id, name, frequency, cron_expression, enabled, next_run_at, last_run_at, created_at`,
		id, name, frequency, cronExpr, enabled, nextRun,
	).Scan(&s.ID, &s.TestID, &s.Name, &s.Frequency, &s.CronExpression,
		&s.Enabled, &s.NextRunAt, &s.LastRunAt, &s.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &s, nil
}

func (q *ScheduleQueries) MarkExecuted(ctx context.Context, id string, nextRun *time.Time) error {
	_, err := q.pool.Exec(ctx,
		`UPDATE test_schedules SET last_run_at=NOW(), next_run_at=$2 WHERE id=$1`, id, nextRun)
	return err
}

func (q *ScheduleQueries) ListDue(ctx context.Context, now time.Time) ([]Schedule, error) {
	rows, err := q.pool.Query(ctx,
		`SELECT id, test_id, name, frequency, cron_expression, enabled, next_run_at, last_run_at, created_at
		 FROM test_schedules
		 WHERE enabled=true AND next_run_at IS NOT NULL AND next_run_at <= $1
		 ORDER BY next_run_at ASC
		 LIMIT 50`, now)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]Schedule, 0)
	for rows.Next() {
		var s Schedule
		if err := rows.Scan(&s.ID, &s.TestID, &s.Name, &s.Frequency, &s.CronExpression,
			&s.Enabled, &s.NextRunAt, &s.LastRunAt, &s.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, s)
	}
	return list, rows.Err()
}

func (q *ScheduleQueries) Delete(ctx context.Context, id string) error {
	_, err := q.pool.Exec(ctx, `DELETE FROM test_schedules WHERE id=$1`, id)
	return err
}
