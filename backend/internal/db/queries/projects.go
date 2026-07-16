package queries

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Project struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type ProjectQueries struct {
	pool *pgxpool.Pool
}

func NewProjectQueries(pool *pgxpool.Pool) *ProjectQueries {
	return &ProjectQueries{pool: pool}
}

func (q *ProjectQueries) List(ctx context.Context) ([]Project, error) {
	rows, err := q.pool.Query(ctx, "SELECT id, name, COALESCE(description,''), created_at, updated_at FROM projects ORDER BY created_at DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []Project
	for rows.Next() {
		var p Project
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		projects = append(projects, p)
	}
	return projects, nil
}

func (q *ProjectQueries) Get(ctx context.Context, id string) (*Project, error) {
	var p Project
	err := q.pool.QueryRow(ctx, "SELECT id, name, COALESCE(description,''), created_at, updated_at FROM projects WHERE id=$1", id).
		Scan(&p.ID, &p.Name, &p.Description, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (q *ProjectQueries) Create(ctx context.Context, id, name, description string) (*Project, error) {
	var p Project
	err := q.pool.QueryRow(ctx,
		"INSERT INTO projects (id, name, description) VALUES ($1, $2, $3) RETURNING id, name, COALESCE(description,''), created_at, updated_at",
		id, name, description,
	).Scan(&p.ID, &p.Name, &p.Description, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (q *ProjectQueries) Update(ctx context.Context, id, name, description string) (*Project, error) {
	var p Project
	err := q.pool.QueryRow(ctx,
		"UPDATE projects SET name=$2, description=$3, updated_at=NOW() WHERE id=$1 RETURNING id, name, COALESCE(description,''), created_at, updated_at",
		id, name, description,
	).Scan(&p.ID, &p.Name, &p.Description, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (q *ProjectQueries) Delete(ctx context.Context, id string) error {
	_, err := q.pool.Exec(ctx, "DELETE FROM projects WHERE id=$1", id)
	return err
}
