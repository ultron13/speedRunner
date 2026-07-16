package queries

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type APIKey struct {
	ID         string     `json:"id"`
	UserID     string     `json:"userId"`
	Name       string     `json:"name"`
	KeyHash    string     `json:"-"`
	LastUsedAt *time.Time `json:"lastUsedAt,omitempty"`
	ExpiresAt  *time.Time `json:"expiresAt,omitempty"`
	CreatedAt  time.Time  `json:"createdAt"`
	// Prefix is a non-secret hint stored only in API responses (first 8 chars of key).
	Prefix string `json:"prefix,omitempty"`
}

type APIKeyQueries struct {
	pool *pgxpool.Pool
}

func NewAPIKeyQueries(pool *pgxpool.Pool) *APIKeyQueries {
	return &APIKeyQueries{pool: pool}
}

func HashAPIKey(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func (q *APIKeyQueries) ListByUser(ctx context.Context, userID string) ([]APIKey, error) {
	rows, err := q.pool.Query(ctx,
		`SELECT id, user_id, name, key_hash, last_used_at, expires_at, created_at
		 FROM api_keys WHERE user_id=$1 ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]APIKey, 0)
	for rows.Next() {
		var k APIKey
		if err := rows.Scan(&k.ID, &k.UserID, &k.Name, &k.KeyHash, &k.LastUsedAt, &k.ExpiresAt, &k.CreatedAt); err != nil {
			return nil, err
		}
		if len(k.KeyHash) >= 8 {
			k.Prefix = k.KeyHash[:8]
		}
		list = append(list, k)
	}
	return list, rows.Err()
}

func (q *APIKeyQueries) Create(ctx context.Context, id, userID, name, keyHash string, expiresAt *time.Time) (*APIKey, error) {
	var k APIKey
	err := q.pool.QueryRow(ctx,
		`INSERT INTO api_keys (id, user_id, name, key_hash, expires_at)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, user_id, name, key_hash, last_used_at, expires_at, created_at`,
		id, userID, name, keyHash, expiresAt,
	).Scan(&k.ID, &k.UserID, &k.Name, &k.KeyHash, &k.LastUsedAt, &k.ExpiresAt, &k.CreatedAt)
	if err != nil {
		return nil, err
	}
	if len(k.KeyHash) >= 8 {
		k.Prefix = k.KeyHash[:8]
	}
	return &k, nil
}

func (q *APIKeyQueries) GetByHash(ctx context.Context, keyHash string) (*APIKey, error) {
	var k APIKey
	err := q.pool.QueryRow(ctx,
		`SELECT id, user_id, name, key_hash, last_used_at, expires_at, created_at
		 FROM api_keys WHERE key_hash=$1`, keyHash,
	).Scan(&k.ID, &k.UserID, &k.Name, &k.KeyHash, &k.LastUsedAt, &k.ExpiresAt, &k.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &k, nil
}

func (q *APIKeyQueries) Touch(ctx context.Context, id string) error {
	_, err := q.pool.Exec(ctx, `UPDATE api_keys SET last_used_at=NOW() WHERE id=$1`, id)
	return err
}

func (q *APIKeyQueries) Delete(ctx context.Context, id, userID string) error {
	_, err := q.pool.Exec(ctx, `DELETE FROM api_keys WHERE id=$1 AND user_id=$2`, id, userID)
	return err
}
