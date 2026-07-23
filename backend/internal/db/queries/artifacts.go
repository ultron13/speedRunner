package queries

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Artifact struct {
	ID          string    `json:"id"`
	RunID       string    `json:"runId"`
	Name        string    `json:"name"`
	Kind        string    `json:"kind"`
	ContentType string    `json:"contentType"`
	SizeBytes   int64     `json:"sizeBytes"`
	Bucket      string    `json:"bucket"`
	ObjectKey   string    `json:"objectKey"`
	URL         string    `json:"url,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
}

type ArtifactQueries struct {
	pool *pgxpool.Pool
}

func NewArtifactQueries(pool *pgxpool.Pool) *ArtifactQueries {
	return &ArtifactQueries{pool: pool}
}

func (q *ArtifactQueries) Create(ctx context.Context, a *Artifact) (*Artifact, error) {
	var out Artifact
	err := q.pool.QueryRow(ctx, `
		INSERT INTO run_artifacts (id, run_id, name, kind, content_type, size_bytes, bucket, object_key, url)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		RETURNING id, run_id, name, kind, content_type, size_bytes, bucket, object_key, COALESCE(url,''), created_at`,
		a.ID, a.RunID, a.Name, a.Kind, a.ContentType, a.SizeBytes, a.Bucket, a.ObjectKey, a.URL,
	).Scan(&out.ID, &out.RunID, &out.Name, &out.Kind, &out.ContentType, &out.SizeBytes,
		&out.Bucket, &out.ObjectKey, &out.URL, &out.CreatedAt)
	return &out, err
}

func (q *ArtifactQueries) ListByRun(ctx context.Context, runID string) ([]Artifact, error) {
	rows, err := q.pool.Query(ctx, `
		SELECT id, run_id, name, kind, content_type, size_bytes, bucket, object_key, COALESCE(url,''), created_at
		FROM run_artifacts WHERE run_id=$1 ORDER BY created_at DESC`, runID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Artifact
	for rows.Next() {
		var a Artifact
		if err := rows.Scan(&a.ID, &a.RunID, &a.Name, &a.Kind, &a.ContentType, &a.SizeBytes,
			&a.Bucket, &a.ObjectKey, &a.URL, &a.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (q *ArtifactQueries) ListRecent(ctx context.Context, limit int) ([]Artifact, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := q.pool.Query(ctx, `
		SELECT id, run_id, name, kind, content_type, size_bytes, bucket, object_key, COALESCE(url,''), created_at
		FROM run_artifacts ORDER BY created_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Artifact
	for rows.Next() {
		var a Artifact
		if err := rows.Scan(&a.ID, &a.RunID, &a.Name, &a.Kind, &a.ContentType, &a.SizeBytes,
			&a.Bucket, &a.ObjectKey, &a.URL, &a.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}
