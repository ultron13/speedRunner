package queries

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	Name         string    `json:"name"`
	PasswordHash string    `json:"-"`
	Role         string    `json:"role"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
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
		`SELECT id, email, name, password_hash, role, created_at, updated_at
		 FROM users WHERE email=$1`, email,
	).Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.Role, &u.CreatedAt, &u.UpdatedAt)
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
		`SELECT id, email, name, password_hash, role, created_at, updated_at
		 FROM users WHERE id=$1`, id,
	).Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.Role, &u.CreatedAt, &u.UpdatedAt)
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
		`INSERT INTO users (id, email, name, password_hash, role)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, email, name, password_hash, role, created_at, updated_at`,
		id, email, name, passwordHash, role,
	).Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.Role, &u.CreatedAt, &u.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (q *UserQueries) Count(ctx context.Context) (int, error) {
	var n int
	err := q.pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&n)
	return n, err
}
