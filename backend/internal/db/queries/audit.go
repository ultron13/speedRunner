package queries

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type AuditLog struct {
	ID           string     `json:"id"`
	UserID       *string    `json:"user_id,omitempty"`
	Action       string     `json:"action"`
	ResourceType string     `json:"resource_type"`
	ResourceID   *string    `json:"resource_id,omitempty"`
	Details      *string    `json:"details,omitempty"`
	IPAddress    *string    `json:"ip_address,omitempty"`
	Timestamp    time.Time  `json:"timestamp"`
}

type AuditQueries struct {
	pool *pgxpool.Pool
}

func NewAuditQueries(pool *pgxpool.Pool) *AuditQueries {
	return &AuditQueries{pool: pool}
}

func (q *AuditQueries) List(ctx context.Context, limit int) ([]AuditLog, error) {
	if limit <= 0 {
		limit = 100
	}
	rows, err := q.pool.Query(ctx, "SELECT id, user_id, action, resource_type, resource_id, details::text, ip_address, timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT $1", limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []AuditLog
	for rows.Next() {
		var l AuditLog
		if err := rows.Scan(&l.ID, &l.UserID, &l.Action, &l.ResourceType, &l.ResourceID, &l.Details, &l.IPAddress, &l.Timestamp); err != nil {
			return nil, err
		}
		logs = append(logs, l)
	}
	return logs, nil
}

func (q *AuditQueries) Create(ctx context.Context, userID *string, action, resourceType string, resourceID *string, details *string, ipAddress *string) error {
	_, err := q.pool.Exec(ctx,
		"INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, ip_address) VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6)",
		userID, action, resourceType, resourceID, details, ipAddress,
	)
	return err
}
