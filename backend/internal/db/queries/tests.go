package queries

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Test struct {
	ID           string     `json:"id"`
	ProjectID    string     `json:"projectId"`
	Name         string     `json:"name"`
	Description  string     `json:"description,omitempty"`
	ScriptType   string     `json:"scriptType"`
	TargetURL    string     `json:"targetUrl"`
	VirtualUsers int        `json:"virtualUsers"`
	Status       string     `json:"status"`
	CreatedAt    time.Time  `json:"createdAt"`
	LastRunAt    *time.Time `json:"lastRunAt,omitempty"`
}

type TestQueries struct {
	pool *pgxpool.Pool
}

func NewTestQueries(pool *pgxpool.Pool) *TestQueries {
	return &TestQueries{pool: pool}
}

func (q *TestQueries) List(ctx context.Context, projectID string) ([]Test, error) {
	var rows pgx.Rows
	var err error
	if projectID != "" {
		rows, err = q.pool.Query(ctx,
			`SELECT id, project_id, name, COALESCE(description,''), script_type, target_url,
			        virtual_users, status, created_at, last_run_at
			 FROM tests WHERE project_id=$1 ORDER BY created_at DESC`, projectID)
	} else {
		rows, err = q.pool.Query(ctx,
			`SELECT id, project_id, name, COALESCE(description,''), script_type, target_url,
			        virtual_users, status, created_at, last_run_at
			 FROM tests ORDER BY created_at DESC`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tests := make([]Test, 0)
	for rows.Next() {
		var t Test
		if err := rows.Scan(&t.ID, &t.ProjectID, &t.Name, &t.Description, &t.ScriptType,
			&t.TargetURL, &t.VirtualUsers, &t.Status, &t.CreatedAt, &t.LastRunAt); err != nil {
			return nil, err
		}
		tests = append(tests, t)
	}
	return tests, rows.Err()
}

func (q *TestQueries) Get(ctx context.Context, id string) (*Test, error) {
	var t Test
	err := q.pool.QueryRow(ctx,
		`SELECT id, project_id, name, COALESCE(description,''), script_type, target_url,
		        virtual_users, status, created_at, last_run_at
		 FROM tests WHERE id=$1`, id,
	).Scan(&t.ID, &t.ProjectID, &t.Name, &t.Description, &t.ScriptType,
		&t.TargetURL, &t.VirtualUsers, &t.Status, &t.CreatedAt, &t.LastRunAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &t, nil
}

func (q *TestQueries) Create(ctx context.Context, id, projectID, name, description, scriptType, targetURL string, virtualUsers int) (*Test, error) {
	var t Test
	err := q.pool.QueryRow(ctx,
		`INSERT INTO tests (id, project_id, name, description, script_type, target_url, virtual_users)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id, project_id, name, COALESCE(description,''), script_type, target_url,
		           virtual_users, status, created_at, last_run_at`,
		id, projectID, name, description, scriptType, targetURL, virtualUsers,
	).Scan(&t.ID, &t.ProjectID, &t.Name, &t.Description, &t.ScriptType,
		&t.TargetURL, &t.VirtualUsers, &t.Status, &t.CreatedAt, &t.LastRunAt)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (q *TestQueries) Update(ctx context.Context, id, name, description, scriptType, targetURL string, virtualUsers int) (*Test, error) {
	var t Test
	err := q.pool.QueryRow(ctx,
		`UPDATE tests SET name=$2, description=$3, script_type=$4, target_url=$5, virtual_users=$6
		 WHERE id=$1
		 RETURNING id, project_id, name, COALESCE(description,''), script_type, target_url,
		           virtual_users, status, created_at, last_run_at`,
		id, name, description, scriptType, targetURL, virtualUsers,
	).Scan(&t.ID, &t.ProjectID, &t.Name, &t.Description, &t.ScriptType,
		&t.TargetURL, &t.VirtualUsers, &t.Status, &t.CreatedAt, &t.LastRunAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &t, nil
}

func (q *TestQueries) UpdateStatus(ctx context.Context, id, status string) error {
	_, err := q.pool.Exec(ctx, `UPDATE tests SET status=$2 WHERE id=$1`, id, status)
	return err
}

func (q *TestQueries) SetLastRun(ctx context.Context, id string) error {
	_, err := q.pool.Exec(ctx, `UPDATE tests SET last_run_at=NOW() WHERE id=$1`, id)
	return err
}

func (q *TestQueries) Delete(ctx context.Context, id string) error {
	_, err := q.pool.Exec(ctx, `DELETE FROM tests WHERE id=$1`, id)
	return err
}

func (q *TestQueries) Count(ctx context.Context) (int, error) {
	var n int
	err := q.pool.QueryRow(ctx, `SELECT COUNT(*) FROM tests`).Scan(&n)
	return n, err
}
