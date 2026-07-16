package queries

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Test struct {
	ID           string         `json:"id"`
	ProjectID    string         `json:"project_id"`
	Name         string         `json:"name"`
	Description  string         `json:"description,omitempty"`
	ScriptType   string         `json:"script_type"`
	TargetURL    string         `json:"target_url"`
	VirtualUsers int            `json:"virtual_users"`
	Status       string         `json:"status"`
	CreatedAt    time.Time      `json:"created_at"`
	LastRunAt    *time.Time     `json:"last_run_at,omitempty"`
}

type TestQueries struct {
	pool *pgxpool.Pool
}

func NewTestQueries(pool *pgxpool.Pool) *TestQueries {
	return &TestQueries{pool: pool}
}

func (q *TestQueries) List(ctx context.Context, projectID string) ([]Test, error) {
	var rows pgxRows
	var err error
	if projectID != "" {
		rows, err = q.pool.Query(ctx, "SELECT id, project_id, name, COALESCE(description,''), script_type, target_url, virtual_users, status, created_at, last_run_at FROM tests WHERE project_id=$1 ORDER BY created_at DESC", projectID)
	} else {
		rows, err = q.pool.Query(ctx, "SELECT id, project_id, name, COALESCE(description,''), script_type, target_url, virtual_users, status, created_at, last_run_at FROM tests ORDER BY created_at DESC")
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tests []Test
	for rows.Next() {
		var t Test
		if err := rows.Scan(&t.ID, &t.ProjectID, &t.Name, &t.Description, &t.ScriptType, &t.TargetURL, &t.VirtualUsers, &t.Status, &t.CreatedAt, &t.LastRunAt); err != nil {
			return nil, err
		}
		tests = append(tests, t)
	}
	return tests, nil
}

func (q *TestQueries) Get(ctx context.Context, id string) (*Test, error) {
	var t Test
	err := q.pool.QueryRow(ctx, "SELECT id, project_id, name, COALESCE(description,''), script_type, target_url, virtual_users, status, created_at, last_run_at FROM tests WHERE id=$1", id).
		Scan(&t.ID, &t.ProjectID, &t.Name, &t.Description, &t.ScriptType, &t.TargetURL, &t.VirtualUsers, &t.Status, &t.CreatedAt, &t.LastRunAt)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (q *TestQueries) Create(ctx context.Context, id, projectID, name, description, scriptType, targetURL string, virtualUsers int) (*Test, error) {
	var t Test
	err := q.pool.QueryRow(ctx,
		"INSERT INTO tests (id, project_id, name, description, script_type, target_url, virtual_users) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, project_id, name, COALESCE(description,''), script_type, target_url, virtual_users, status, created_at, last_run_at",
		id, projectID, name, description, scriptType, targetURL, virtualUsers,
	).Scan(&t.ID, &t.ProjectID, &t.Name, &t.Description, &t.ScriptType, &t.TargetURL, &t.VirtualUsers, &t.Status, &t.CreatedAt, &t.LastRunAt)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (q *TestQueries) UpdateStatus(ctx context.Context, id, status string) error {
	_, err := q.pool.Exec(ctx, "UPDATE tests SET status=$2, updated_at=NOW() WHERE id=$1", id, status)
	return err
}

func (q *TestQueries) SetLastRun(ctx context.Context, id string) error {
	_, err := q.pool.Exec(ctx, "UPDATE tests SET last_run_at=NOW(), updated_at=NOW() WHERE id=$1", id)
	return err
}

func (q *TestQueries) Delete(ctx context.Context, id string) error {
	_, err := q.pool.Exec(ctx, "DELETE FROM tests WHERE id=$1", id)
	return err
}

// pgxRows is an interface to abstract pgx.Rows
type pgxRows interface {
	Close()
	Next() bool
	Scan(dest ...any) error
}
