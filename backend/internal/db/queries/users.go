package queries

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type User struct {
	ID             string    `json:"id"`
	Email          string    `json:"email"`
	Name           string    `json:"name"`
	PasswordHash   string    `json:"-"`
	Role           string    `json:"role"`
	Active         bool      `json:"active"`
	SCIMExternalID string    `json:"scimExternalId,omitempty"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

type UserQueries struct {
	pool *pgxpool.Pool
}

func NewUserQueries(pool *pgxpool.Pool) *UserQueries {
	return &UserQueries{pool: pool}
}

func (q *UserQueries) GetByEmail(ctx context.Context, email string) (*User, error) {
	var u User
	err := q.pool.QueryRow(ctx,
		`SELECT id, email, name, password_hash, role, COALESCE(active,true), COALESCE(scim_external_id,''), created_at, updated_at
		 FROM users WHERE email=$1`, email,
	).Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.Role, &u.Active, &u.SCIMExternalID, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &u, nil
}

func (q *UserQueries) GetByID(ctx context.Context, id string) (*User, error) {
	var u User
	err := q.pool.QueryRow(ctx,
		`SELECT id, email, name, password_hash, role, COALESCE(active,true), COALESCE(scim_external_id,''), created_at, updated_at
		 FROM users WHERE id=$1`, id,
	).Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.Role, &u.Active, &u.SCIMExternalID, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &u, nil
}

func (q *UserQueries) Create(ctx context.Context, id, email, name, passwordHash, role string) (*User, error) {
	var u User
	err := q.pool.QueryRow(ctx,
		`INSERT INTO users (id, email, name, password_hash, role, active)
		 VALUES ($1, $2, $3, $4, $5, true)
		 RETURNING id, email, name, password_hash, role, COALESCE(active,true), COALESCE(scim_external_id,''), created_at, updated_at`,
		id, email, name, passwordHash, role,
	).Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.Role, &u.Active, &u.SCIMExternalID, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// UpsertOIDC creates or updates a user provisioned via OIDC/SSO.
func (q *UserQueries) UpsertOIDC(ctx context.Context, id, email, name, role string) (*User, error) {
	existing, err := q.GetByEmail(ctx, email)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		_, err := q.pool.Exec(ctx,
			`UPDATE users SET name=$2, updated_at=NOW(), active=true WHERE id=$1`,
			existing.ID, name,
		)
		if err != nil {
			return nil, err
		}
		return q.GetByID(ctx, existing.ID)
	}
	// Random unusable password hash placeholder for SSO-only accounts
	return q.Create(ctx, id, email, name, "!oidc!", role)
}

// UpsertSCIM provisions from SCIM directory.
func (q *UserQueries) UpsertSCIM(ctx context.Context, id, email, name, role, externalID string, active bool) (*User, error) {
	if email == "" {
		return nil, errors.New("email required")
	}
	existing, _ := q.GetByEmail(ctx, email)
	if existing != nil {
		_, err := q.pool.Exec(ctx, `
			UPDATE users SET name=$2, role=COALESCE(NULLIF($3,''), role), active=$4,
			       scim_external_id=COALESCE(NULLIF($5,''), scim_external_id), updated_at=NOW()
			WHERE id=$1`, existing.ID, name, role, active, externalID)
		if err != nil {
			return nil, err
		}
		return q.GetByID(ctx, existing.ID)
	}
	var u User
	err := q.pool.QueryRow(ctx, `
		INSERT INTO users (id, email, name, password_hash, role, active, scim_external_id)
		VALUES ($1,$2,$3,'!scim!',$4,$5,$6)
		RETURNING id, email, name, password_hash, role, COALESCE(active,true), COALESCE(scim_external_id,''), created_at, updated_at`,
		id, email, name, role, active, externalID,
	).Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.Role, &u.Active, &u.SCIMExternalID, &u.CreatedAt, &u.UpdatedAt)
	return &u, err
}

func (q *UserQueries) SetActive(ctx context.Context, id string, active bool) error {
	_, err := q.pool.Exec(ctx, `UPDATE users SET active=$2, updated_at=NOW() WHERE id=$1`, id, active)
	return err
}

func (q *UserQueries) List(ctx context.Context, limit int) ([]User, error) {
	if limit <= 0 {
		limit = 100
	}
	rows, err := q.pool.Query(ctx, `
		SELECT id, email, name, password_hash, role, COALESCE(active,true), COALESCE(scim_external_id,''), created_at, updated_at
		FROM users ORDER BY created_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.Role, &u.Active, &u.SCIMExternalID, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func (q *UserQueries) Count(ctx context.Context) (int, error) {
	var n int
	err := q.pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&n)
	return n, err
}
