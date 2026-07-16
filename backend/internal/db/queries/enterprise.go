package queries

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ── Environments ────────────────────────────────────────────────────────────

type Environment struct {
	ID        string    `json:"id"`
	ProjectID string    `json:"projectId"`
	Name      string    `json:"name"`
	BaseURL   string    `json:"baseUrl"`
	Region    string    `json:"region"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
}

type EnvironmentQueries struct{ pool *pgxpool.Pool }

func NewEnvironmentQueries(pool *pgxpool.Pool) *EnvironmentQueries {
	return &EnvironmentQueries{pool: pool}
}

func (q *EnvironmentQueries) List(ctx context.Context, projectID string) ([]Environment, error) {
	var rows pgx.Rows
	var err error
	if projectID != "" {
		rows, err = q.pool.Query(ctx,
			`SELECT id, project_id, name, base_url, region, status, created_at
			 FROM environments WHERE project_id=$1 ORDER BY name`, projectID)
	} else {
		rows, err = q.pool.Query(ctx,
			`SELECT id, project_id, name, base_url, region, status, created_at
			 FROM environments ORDER BY name`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := make([]Environment, 0)
	for rows.Next() {
		var e Environment
		if err := rows.Scan(&e.ID, &e.ProjectID, &e.Name, &e.BaseURL, &e.Region, &e.Status, &e.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, e)
	}
	return list, rows.Err()
}

func (q *EnvironmentQueries) Create(ctx context.Context, id, projectID, name, baseURL, region string) (*Environment, error) {
	var e Environment
	err := q.pool.QueryRow(ctx,
		`INSERT INTO environments (id, project_id, name, base_url, region)
		 VALUES ($1,$2,$3,$4,$5)
		 RETURNING id, project_id, name, base_url, region, status, created_at`,
		id, projectID, name, baseURL, region,
	).Scan(&e.ID, &e.ProjectID, &e.Name, &e.BaseURL, &e.Region, &e.Status, &e.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &e, nil
}

func (q *EnvironmentQueries) Delete(ctx context.Context, id string) error {
	_, err := q.pool.Exec(ctx, `DELETE FROM environments WHERE id=$1`, id)
	return err
}

// ── Load generator pools ────────────────────────────────────────────────────

type LoadGeneratorPool struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Region      string    `json:"region"`
	Engine      string    `json:"engine"`
	CapacityVUs int       `json:"capacityVUs"`
	UsedVUs     int       `json:"usedVUs"`
	Status      string    `json:"status"`
	Namespace   *string   `json:"namespace,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
}

type PoolQueries struct{ pool *pgxpool.Pool }

func NewPoolQueries(pool *pgxpool.Pool) *PoolQueries {
	return &PoolQueries{pool: pool}
}

func (q *PoolQueries) List(ctx context.Context) ([]LoadGeneratorPool, error) {
	rows, err := q.pool.Query(ctx,
		`SELECT id, name, region, engine, capacity_vus, used_vus, status, namespace, created_at
		 FROM load_generator_pools ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := make([]LoadGeneratorPool, 0)
	for rows.Next() {
		var p LoadGeneratorPool
		if err := rows.Scan(&p.ID, &p.Name, &p.Region, &p.Engine, &p.CapacityVUs, &p.UsedVUs,
			&p.Status, &p.Namespace, &p.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, p)
	}
	return list, rows.Err()
}

func (q *PoolQueries) Create(ctx context.Context, id, name, region, engine string, capacity int, namespace *string) (*LoadGeneratorPool, error) {
	var p LoadGeneratorPool
	err := q.pool.QueryRow(ctx,
		`INSERT INTO load_generator_pools (id, name, region, engine, capacity_vus, namespace)
		 VALUES ($1,$2,$3,$4,$5,$6)
		 RETURNING id, name, region, engine, capacity_vus, used_vus, status, namespace, created_at`,
		id, name, region, engine, capacity, namespace,
	).Scan(&p.ID, &p.Name, &p.Region, &p.Engine, &p.CapacityVUs, &p.UsedVUs, &p.Status, &p.Namespace, &p.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (q *PoolQueries) Reserve(ctx context.Context, id string, vus int) error {
	tag, err := q.pool.Exec(ctx,
		`UPDATE load_generator_pools SET used_vus = used_vus + $2
		 WHERE id=$1 AND used_vus + $2 <= capacity_vus AND status='HEALTHY'`, id, vus)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errors.New("insufficient pool capacity or pool unhealthy")
	}
	return nil
}

func (q *PoolQueries) Release(ctx context.Context, id string, vus int) error {
	_, err := q.pool.Exec(ctx,
		`UPDATE load_generator_pools SET used_vus = GREATEST(0, used_vus - $2) WHERE id=$1`, id, vus)
	return err
}

func (q *PoolQueries) PickBest(ctx context.Context, neededVUs int, engine string) (*LoadGeneratorPool, error) {
	var p LoadGeneratorPool
	err := q.pool.QueryRow(ctx,
		`SELECT id, name, region, engine, capacity_vus, used_vus, status, namespace, created_at
		 FROM load_generator_pools
		 WHERE status='HEALTHY' AND capacity_vus - used_vus >= $1
		   AND ($2 = '' OR engine = $2 OR engine = 'any')
		 ORDER BY (capacity_vus - used_vus) DESC
		 LIMIT 1`, neededVUs, engine,
	).Scan(&p.ID, &p.Name, &p.Region, &p.Engine, &p.CapacityVUs, &p.UsedVUs, &p.Status, &p.Namespace, &p.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}

// ── Applications ────────────────────────────────────────────────────────────

type Application struct {
	ID          string    `json:"id"`
	ProjectID   string    `json:"projectId"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	Owner       string    `json:"owner,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
}

type ApplicationQueries struct{ pool *pgxpool.Pool }

func NewApplicationQueries(pool *pgxpool.Pool) *ApplicationQueries {
	return &ApplicationQueries{pool: pool}
}

func (q *ApplicationQueries) List(ctx context.Context, projectID string) ([]Application, error) {
	var rows pgx.Rows
	var err error
	if projectID != "" {
		rows, err = q.pool.Query(ctx,
			`SELECT id, project_id, name, COALESCE(description,''), COALESCE(owner,''), created_at
			 FROM applications WHERE project_id=$1 ORDER BY name`, projectID)
	} else {
		rows, err = q.pool.Query(ctx,
			`SELECT id, project_id, name, COALESCE(description,''), COALESCE(owner,''), created_at
			 FROM applications ORDER BY name`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := make([]Application, 0)
	for rows.Next() {
		var a Application
		if err := rows.Scan(&a.ID, &a.ProjectID, &a.Name, &a.Description, &a.Owner, &a.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, a)
	}
	return list, rows.Err()
}

func (q *ApplicationQueries) Create(ctx context.Context, id, projectID, name, description, owner string) (*Application, error) {
	var a Application
	err := q.pool.QueryRow(ctx,
		`INSERT INTO applications (id, project_id, name, description, owner)
		 VALUES ($1,$2,$3,$4,$5)
		 RETURNING id, project_id, name, COALESCE(description,''), COALESCE(owner,''), created_at`,
		id, projectID, name, description, owner,
	).Scan(&a.ID, &a.ProjectID, &a.Name, &a.Description, &a.Owner, &a.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// ── Reports ─────────────────────────────────────────────────────────────────

type Report struct {
	ID         string          `json:"id"`
	RunID      *string         `json:"runId,omitempty"`
	ProjectID  *string         `json:"projectId,omitempty"`
	Name       string          `json:"name"`
	ReportType string          `json:"reportType"`
	Summary    string          `json:"summary,omitempty"`
	Payload    json.RawMessage `json:"payload,omitempty"`
	CreatedAt  time.Time       `json:"createdAt"`
}

type ReportQueries struct{ pool *pgxpool.Pool }

func NewReportQueries(pool *pgxpool.Pool) *ReportQueries {
	return &ReportQueries{pool: pool}
}

func (q *ReportQueries) List(ctx context.Context, limit int) ([]Report, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := q.pool.Query(ctx,
		`SELECT id, run_id, project_id, name, report_type, COALESCE(summary,''), payload, created_at
		 FROM reports ORDER BY created_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	list := make([]Report, 0)
	for rows.Next() {
		var r Report
		if err := rows.Scan(&r.ID, &r.RunID, &r.ProjectID, &r.Name, &r.ReportType, &r.Summary, &r.Payload, &r.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, r)
	}
	return list, rows.Err()
}

func (q *ReportQueries) Create(ctx context.Context, id string, runID, projectID *string, name, reportType, summary string, payload []byte) (*Report, error) {
	var r Report
	err := q.pool.QueryRow(ctx,
		`INSERT INTO reports (id, run_id, project_id, name, report_type, summary, payload)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)
		 RETURNING id, run_id, project_id, name, report_type, COALESCE(summary,''), payload, created_at`,
		id, runID, projectID, name, reportType, summary, payload,
	).Scan(&r.ID, &r.RunID, &r.ProjectID, &r.Name, &r.ReportType, &r.Summary, &r.Payload, &r.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

func (q *ReportQueries) Get(ctx context.Context, id string) (*Report, error) {
	var r Report
	err := q.pool.QueryRow(ctx,
		`SELECT id, run_id, project_id, name, report_type, COALESCE(summary,''), payload, created_at
		 FROM reports WHERE id=$1`, id,
	).Scan(&r.ID, &r.RunID, &r.ProjectID, &r.Name, &r.ReportType, &r.Summary, &r.Payload, &r.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &r, nil
}

// ── Dashboard aggregates ────────────────────────────────────────────────────

type DashboardSummary struct {
	TotalTests      int      `json:"totalTests"`
	RunningTests    int      `json:"runningTests"`
	CompletedRuns   int      `json:"completedRuns"`
	FailedRuns      int      `json:"failedRuns"`
	AvgResponseTime float64  `json:"avgResponseTime"`
	AvgThroughput   float64  `json:"avgThroughput"`
	AvgErrorRate    float64  `json:"avgErrorRate"`
	PoolCapacity    int      `json:"poolCapacity"`
	PoolUsed        int      `json:"poolUsed"`
	OpenSLABreaches int      `json:"openSlaBreaches"`
	ScheduledJobs   int      `json:"scheduledJobs"`
}

func DashboardSummaryQuery(ctx context.Context, pool *pgxpool.Pool) (*DashboardSummary, error) {
	s := &DashboardSummary{}
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM tests`).Scan(&s.TotalTests)
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM tests WHERE status='RUNNING'`).Scan(&s.RunningTests)
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM runs WHERE status='COMPLETED'`).Scan(&s.CompletedRuns)
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM runs WHERE status='FAILED'`).Scan(&s.FailedRuns)
	_ = pool.QueryRow(ctx,
		`SELECT COALESCE(AVG(avg_response_time),0), COALESCE(AVG(throughput),0), COALESCE(AVG(error_rate),0)
		 FROM runs WHERE status IN ('COMPLETED','STOPPED') AND avg_response_time IS NOT NULL`,
	).Scan(&s.AvgResponseTime, &s.AvgThroughput, &s.AvgErrorRate)
	_ = pool.QueryRow(ctx, `SELECT COALESCE(SUM(capacity_vus),0), COALESCE(SUM(used_vus),0) FROM load_generator_pools`).Scan(&s.PoolCapacity, &s.PoolUsed)
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM sla_results WHERE passed=false`).Scan(&s.OpenSLABreaches)
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM test_schedules WHERE enabled=true`).Scan(&s.ScheduledJobs)
	return s, nil
}
