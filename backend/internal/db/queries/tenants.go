package queries

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Tenant struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Plan      string    `json:"plan"`
	Region    string    `json:"region"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type TenantQueries struct {
	pool *pgxpool.Pool
}

func NewTenantQueries(pool *pgxpool.Pool) *TenantQueries {
	return &TenantQueries{pool: pool}
}

func (q *TenantQueries) Upsert(ctx context.Context, t *Tenant) (*Tenant, error) {
	if t.Plan == "" {
		t.Plan = "team"
	}
	if t.Status == "" {
		t.Status = "active"
	}
	if t.Region == "" {
		t.Region = "local"
	}
	var out Tenant
	err := q.pool.QueryRow(ctx, `
		INSERT INTO tenants (id, name, plan, region, status)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (id) DO UPDATE SET
			name = EXCLUDED.name,
			plan = EXCLUDED.plan,
			region = EXCLUDED.region,
			status = EXCLUDED.status,
			updated_at = NOW()
		RETURNING id, name, plan, region, status, created_at, updated_at`,
		t.ID, t.Name, t.Plan, t.Region, t.Status,
	).Scan(&out.ID, &out.Name, &out.Plan, &out.Region, &out.Status, &out.CreatedAt, &out.UpdatedAt)
	return &out, err
}

func (q *TenantQueries) List(ctx context.Context) ([]Tenant, error) {
	rows, err := q.pool.Query(ctx, `
		SELECT id, name, plan, region, status, created_at, updated_at
		FROM tenants ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Tenant
	for rows.Next() {
		var t Tenant
		if err := rows.Scan(&t.ID, &t.Name, &t.Plan, &t.Region, &t.Status, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (q *TenantQueries) Get(ctx context.Context, id string) (*Tenant, error) {
	var t Tenant
	err := q.pool.QueryRow(ctx, `
		SELECT id, name, plan, region, status, created_at, updated_at
		FROM tenants WHERE id=$1`, id,
	).Scan(&t.ID, &t.Name, &t.Plan, &t.Region, &t.Status, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &t, nil
}
