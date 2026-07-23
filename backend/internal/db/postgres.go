package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/belo/speedrunner/backend/internal/config"
)

type Postgres struct {
	Pool *pgxpool.Pool
}

func NewPostgres(ctx context.Context, cfg config.DatabaseConfig) (*Postgres, error) {
	pool, err := pgxpool.New(ctx, cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("unable to create connection pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("unable to ping database: %w", err)
	}

	return &Postgres{Pool: pool}, nil
}

func (pg *Postgres) Close() {
	pg.Pool.Close()
}

func (pg *Postgres) RunMigrations(ctx context.Context) error {
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			email TEXT UNIQUE NOT NULL,
			name TEXT NOT NULL,
			password_hash TEXT NOT NULL,
			role TEXT NOT NULL DEFAULT 'READ_ONLY',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS projects (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			description TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS project_members (
			id TEXT PRIMARY KEY,
			project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			role TEXT NOT NULL DEFAULT 'MEMBER',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE(project_id, user_id)
		)`,
		`CREATE TABLE IF NOT EXISTS tests (
			id TEXT PRIMARY KEY,
			project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			description TEXT,
			script_type TEXT NOT NULL DEFAULT 'HTTP',
			target_url TEXT NOT NULL,
			virtual_users INT NOT NULL DEFAULT 10,
			status TEXT NOT NULL DEFAULT 'IDLE',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			last_run_at TIMESTAMPTZ
		)`,
		`CREATE TABLE IF NOT EXISTS runs (
			id TEXT PRIMARY KEY,
			test_id TEXT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
			status TEXT NOT NULL DEFAULT 'RUNNING',
			started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			completed_at TIMESTAMPTZ,
			duration FLOAT,
			throughput FLOAT,
			avg_response_time FLOAT,
			p50 FLOAT,
			p90 FLOAT,
			p95 FLOAT,
			p99 FLOAT,
			error_rate FLOAT,
			triggered_by TEXT,
			trigger_type TEXT NOT NULL DEFAULT 'MANUAL'
		)`,
		`CREATE INDEX IF NOT EXISTS idx_runs_test_id ON runs(test_id)`,
		`CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs(started_at)`,
		`CREATE TABLE IF NOT EXISTS run_metrics (
			id TEXT PRIMARY KEY,
			run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
			timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			duration FLOAT NOT NULL,
			throughput FLOAT NOT NULL,
			avg_response_time FLOAT NOT NULL,
			error_rate FLOAT NOT NULL,
			active_v_users INT NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_run_metrics_run_timestamp ON run_metrics(run_id, timestamp)`,
		`CREATE TABLE IF NOT EXISTS sla_thresholds (
			id TEXT PRIMARY KEY,
			project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			metric TEXT NOT NULL,
			condition TEXT NOT NULL,
			value FLOAT NOT NULL,
			enabled BOOLEAN NOT NULL DEFAULT true
		)`,
		`CREATE TABLE IF NOT EXISTS sla_results (
			id TEXT PRIMARY KEY,
			run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
			threshold_id TEXT NOT NULL REFERENCES sla_thresholds(id) ON DELETE CASCADE,
			actual_value FLOAT NOT NULL,
			passed BOOLEAN NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS test_templates (
			id TEXT PRIMARY KEY,
			project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			description TEXT,
			script_type TEXT NOT NULL DEFAULT 'HTTP',
			target_url TEXT NOT NULL,
			virtual_users INT NOT NULL DEFAULT 10,
			usage_count INT NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS test_schedules (
			id TEXT PRIMARY KEY,
			test_id TEXT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			frequency TEXT NOT NULL DEFAULT 'ONCE',
			cron_expression TEXT,
			enabled BOOLEAN NOT NULL DEFAULT true,
			next_run_at TIMESTAMPTZ,
			last_run_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS timeline_events (
			id TEXT PRIMARY KEY,
			test_id TEXT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
			run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
			type TEXT NOT NULL,
			message TEXT NOT NULL,
			timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_timeline_test_timestamp ON timeline_events(test_id, timestamp)`,
		`CREATE TABLE IF NOT EXISTS api_keys (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			key_hash TEXT UNIQUE NOT NULL,
			last_used_at TIMESTAMPTZ,
			expires_at TIMESTAMPTZ,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS audit_logs (
			id TEXT PRIMARY KEY,
			user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
			action TEXT NOT NULL,
			resource_type TEXT NOT NULL,
			resource_id TEXT,
			details JSONB,
			ip_address TEXT,
			timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp)`,
		`CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id)`,
		// ── Enterprise catalog (LoadRunner-class parity) ───────────────────
		`CREATE TABLE IF NOT EXISTS environments (
			id TEXT PRIMARY KEY,
			project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			base_url TEXT NOT NULL,
			region TEXT NOT NULL DEFAULT 'local',
			status TEXT NOT NULL DEFAULT 'ACTIVE',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS load_generator_pools (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			region TEXT NOT NULL DEFAULT 'local',
			engine TEXT NOT NULL DEFAULT 'simulate',
			capacity_vus INT NOT NULL DEFAULT 1000,
			used_vus INT NOT NULL DEFAULT 0,
			status TEXT NOT NULL DEFAULT 'HEALTHY',
			namespace TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS applications (
			id TEXT PRIMARY KEY,
			project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			description TEXT,
			owner TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS reports (
			id TEXT PRIMARY KEY,
			run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
			project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
			name TEXT NOT NULL,
			report_type TEXT NOT NULL DEFAULT 'ENGINEERING',
			summary TEXT,
			payload JSONB,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at)`,
		`CREATE INDEX IF NOT EXISTS idx_env_project ON environments(project_id)`,
		`CREATE INDEX IF NOT EXISTS idx_apps_project ON applications(project_id)`,
		// Vertical-slice durability: tenants, SCIM link, run artifacts
		`CREATE TABLE IF NOT EXISTS tenants (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			plan TEXT NOT NULL DEFAULT 'team',
			region TEXT NOT NULL DEFAULT 'local',
			status TEXT NOT NULL DEFAULT 'active',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS scim_external_id TEXT`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_scim_external ON users(scim_external_id) WHERE scim_external_id IS NOT NULL`,
		`CREATE TABLE IF NOT EXISTS run_artifacts (
			id TEXT PRIMARY KEY,
			run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			kind TEXT NOT NULL DEFAULT 'summary',
			content_type TEXT NOT NULL DEFAULT 'application/json',
			size_bytes BIGINT NOT NULL DEFAULT 0,
			bucket TEXT NOT NULL DEFAULT 'speedrunner-results',
			object_key TEXT NOT NULL,
			url TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_artifacts_run ON run_artifacts(run_id)`,
		`INSERT INTO tenants (id, name, plan, region, status)
		 VALUES ('default', 'Default Workspace', 'enterprise', 'local', 'active')
		 ON CONFLICT (id) DO NOTHING`,
	}

	for _, m := range migrations {
		if _, err := pg.Pool.Exec(ctx, m); err != nil {
			return fmt.Errorf("migration failed: %w\nSQL: %s", err, m)
		}
	}

	return nil
}
