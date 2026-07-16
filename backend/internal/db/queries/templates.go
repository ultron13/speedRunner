package queries

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Template struct {
	ID           string    `json:"id"`
	ProjectID    string    `json:"projectId"`
	Name         string    `json:"name"`
	Description  string    `json:"description,omitempty"`
	ScriptType   string    `json:"scriptType"`
	TargetURL    string    `json:"targetUrl"`
	VirtualUsers int       `json:"virtualUsers"`
	UsageCount   int       `json:"usageCount"`
	CreatedAt    time.Time `json:"createdAt"`
}

type TemplateQueries struct {
	pool *pgxpool.Pool
}

func NewTemplateQueries(pool *pgxpool.Pool) *TemplateQueries {
	return &TemplateQueries{pool: pool}
}

func (q *TemplateQueries) List(ctx context.Context, projectID string) ([]Template, error) {
	var rows pgx.Rows
	var err error
	if projectID != "" {
		rows, err = q.pool.Query(ctx,
			`SELECT id, project_id, name, COALESCE(description,''), script_type, target_url,
			        virtual_users, usage_count, created_at
			 FROM test_templates WHERE project_id=$1 ORDER BY usage_count DESC, created_at DESC`, projectID)
	} else {
		rows, err = q.pool.Query(ctx,
			`SELECT id, project_id, name, COALESCE(description,''), script_type, target_url,
			        virtual_users, usage_count, created_at
			 FROM test_templates ORDER BY usage_count DESC, created_at DESC`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]Template, 0)
	for rows.Next() {
		var t Template
		if err := rows.Scan(&t.ID, &t.ProjectID, &t.Name, &t.Description, &t.ScriptType,
			&t.TargetURL, &t.VirtualUsers, &t.UsageCount, &t.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, t)
	}
	return list, rows.Err()
}

func (q *TemplateQueries) Get(ctx context.Context, id string) (*Template, error) {
	var t Template
	err := q.pool.QueryRow(ctx,
		`SELECT id, project_id, name, COALESCE(description,''), script_type, target_url,
		        virtual_users, usage_count, created_at
		 FROM test_templates WHERE id=$1`, id,
	).Scan(&t.ID, &t.ProjectID, &t.Name, &t.Description, &t.ScriptType,
		&t.TargetURL, &t.VirtualUsers, &t.UsageCount, &t.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &t, nil
}

func (q *TemplateQueries) Create(ctx context.Context, id, projectID, name, description, scriptType, targetURL string, virtualUsers int) (*Template, error) {
	var t Template
	err := q.pool.QueryRow(ctx,
		`INSERT INTO test_templates (id, project_id, name, description, script_type, target_url, virtual_users)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id, project_id, name, COALESCE(description,''), script_type, target_url,
		           virtual_users, usage_count, created_at`,
		id, projectID, name, description, scriptType, targetURL, virtualUsers,
	).Scan(&t.ID, &t.ProjectID, &t.Name, &t.Description, &t.ScriptType,
		&t.TargetURL, &t.VirtualUsers, &t.UsageCount, &t.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (q *TemplateQueries) IncrementUsage(ctx context.Context, id string) error {
	_, err := q.pool.Exec(ctx, `UPDATE test_templates SET usage_count = usage_count + 1 WHERE id=$1`, id)
	return err
}

func (q *TemplateQueries) Delete(ctx context.Context, id string) error {
	_, err := q.pool.Exec(ctx, `DELETE FROM test_templates WHERE id=$1`, id)
	return err
}
