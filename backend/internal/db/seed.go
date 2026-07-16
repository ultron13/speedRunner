package db

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/belo/speedrunner/backend/internal/db/queries"
)

// SeedDefaults creates admin user, catalog data, SLA, templates, pools, and sample tests.
func SeedDefaults(ctx context.Context, pg *Postgres) error {
	users := queries.NewUserQueries(pg.Pool)
	projects := queries.NewProjectQueries(pg.Pool)
	sla := queries.NewSLAQueries(pg.Pool)
	templates := queries.NewTemplateQueries(pg.Pool)
	envs := queries.NewEnvironmentQueries(pg.Pool)
	pools := queries.NewPoolQueries(pg.Pool)
	apps := queries.NewApplicationQueries(pg.Pool)
	tests := queries.NewTestQueries(pg.Pool)

	count, err := users.Count(ctx)
	if err != nil {
		return fmt.Errorf("count users: %w", err)
	}
	if count == 0 {
		hash, err := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("hash admin password: %w", err)
		}
		if _, err := users.Create(ctx, uuid.New().String(), "admin@speedrunner.local", "Admin", string(hash), "PLATFORM_ADMIN"); err != nil {
			return fmt.Errorf("seed admin user: %w", err)
		}
		// Secondary demo users
		for _, u := range []struct{ email, name, role, pass string }{
			{"lead@speedrunner.local", "Performance Lead", "PERFORMANCE_LEAD", "lead123"},
			{"engineer@speedrunner.local", "Perf Engineer", "PERFORMANCE_ENGINEER", "eng123"},
			{"viewer@speedrunner.local", "Viewer", "READ_ONLY", "view123"},
		} {
			h, _ := bcrypt.GenerateFromPassword([]byte(u.pass), bcrypt.DefaultCost)
			if _, err := users.Create(ctx, uuid.New().String(), u.email, u.name, string(h), u.role); err != nil {
				return fmt.Errorf("seed user %s: %w", u.email, err)
			}
		}
		fmt.Println("[seed] created admin@speedrunner.local / admin123 (+ demo users)")
	}

	var projectID string
	plist, err := projects.List(ctx)
	if err != nil {
		return fmt.Errorf("list projects: %w", err)
	}
	if len(plist) == 0 {
		p, err := projects.Create(ctx, uuid.New().String(), "Default Project", "Primary performance engineering project")
		if err != nil {
			return fmt.Errorf("seed default project: %w", err)
		}
		projectID = p.ID
		_, _ = projects.Create(ctx, uuid.New().String(), "E-Commerce Platform", "Checkout and catalog load testing")
		fmt.Println("[seed] created projects")
	} else {
		projectID = plist[0].ID
	}

	// SLA
	existingSLA, err := sla.ListThresholds(ctx, projectID)
	if err != nil {
		return fmt.Errorf("list sla: %w", err)
	}
	if len(existingSLA) == 0 {
		for _, s := range []struct {
			name, metric, cond string
			value              float64
		}{
			{"Max Avg Response Time", "avg_response_time", "lte", 500},
			{"Max Error Rate", "error_rate", "lte", 5},
			{"Min Throughput", "throughput", "gte", 10},
			{"Max P95 Latency", "p95", "lte", 1000},
		} {
			if _, err := sla.CreateThreshold(ctx, uuid.New().String(), projectID, s.name, s.metric, s.cond, s.value); err != nil {
				return fmt.Errorf("seed sla: %w", err)
			}
		}
		fmt.Println("[seed] created SLA thresholds")
	}

	// Templates
	existingTmpl, err := templates.List(ctx, projectID)
	if err != nil {
		return fmt.Errorf("list templates: %w", err)
	}
	if len(existingTmpl) == 0 {
		for _, t := range []struct {
			name, desc, script, url string
			vus                     int
		}{
			{"API Smoke", "Light smoke test for APIs", "HTTP", "https://api.example.com/health", 10},
			{"Login Load", "Login flow load profile", "JMeter", "https://app.example.com/login", 100},
			{"Checkout Stress", "Checkout stress scenario", "k6", "https://shop.example.com/checkout", 250},
			{"Search Soak", "Long-running search soak", "HTTP", "https://shop.example.com/search", 50},
		} {
			if _, err := templates.Create(ctx, uuid.New().String(), projectID, t.name, t.desc, t.script, t.url, t.vus); err != nil {
				return fmt.Errorf("seed template: %w", err)
			}
		}
		fmt.Println("[seed] created test templates")
	}

	// Environments
	existingEnv, err := envs.List(ctx, projectID)
	if err != nil {
		return fmt.Errorf("list envs: %w", err)
	}
	if len(existingEnv) == 0 {
		for _, e := range []struct{ name, url, region string }{
			{"Production", "https://api.example.com", "us-east"},
			{"Staging", "https://staging.api.example.com", "us-east"},
			{"Performance Lab", "https://perf.lab.example.com", "local"},
		} {
			if _, err := envs.Create(ctx, uuid.New().String(), projectID, e.name, e.url, e.region); err != nil {
				return fmt.Errorf("seed env: %w", err)
			}
		}
		fmt.Println("[seed] created environments")
	}

	// Load generator pools
	existingPools, err := pools.List(ctx)
	if err != nil {
		return fmt.Errorf("list pools: %w", err)
	}
	if len(existingPools) == 0 {
		ns := "marathonrunner-execution"
		for _, p := range []struct {
			name, region, engine string
			cap                  int
		}{
			{"Local Simulator Pool", "local", "simulate", 10000},
			{"US-East K8s JMeter", "us-east", "jmeter", 5000},
			{"EU-West K8s k6", "eu-west", "k6", 5000},
			{"HTTP In-Process", "local", "http", 500},
		} {
			var nsptr *string
			if p.engine == "jmeter" || p.engine == "k6" {
				nsptr = &ns
			}
			if _, err := pools.Create(ctx, uuid.New().String(), p.name, p.region, p.engine, p.cap, nsptr); err != nil {
				return fmt.Errorf("seed pool: %w", err)
			}
		}
		fmt.Println("[seed] created load generator pools")
	}

	// Applications
	existingApps, err := apps.List(ctx, projectID)
	if err != nil {
		return fmt.Errorf("list apps: %w", err)
	}
	if len(existingApps) == 0 {
		for _, a := range []struct{ name, desc, owner string }{
			{"Customer Portal", "Web + API customer-facing app", "platform-team"},
			{"Checkout Service", "Payment and cart microservice", "commerce-team"},
			{"Search API", "Product search backend", "search-team"},
		} {
			if _, err := apps.Create(ctx, uuid.New().String(), projectID, a.name, a.desc, a.owner); err != nil {
				return fmt.Errorf("seed app: %w", err)
			}
		}
		fmt.Println("[seed] created applications")
	}

	// Demo tests
	tcount, err := tests.Count(ctx)
	if err != nil {
		return fmt.Errorf("count tests: %w", err)
	}
	if tcount == 0 {
		demo := []struct {
			name, desc, script, url string
			vus                     int
		}{
			{"Login Flow Load Test", "Simulates concurrent user logins", "HTTP", "https://api.example.com/v1/login", 200},
			{"API Health Check - Prod", "Synthetic health probe", "HTTP", "https://api.example.com/health", 50},
			{"Checkout Performance", "End-to-end checkout under load", "JMeter", "https://shop.example.com/checkout", 500},
			{"Search API Stress Test", "Search endpoint stress", "k6", "https://shop.example.com/search", 1000},
			{"Catalog Browse", "Product listing browse pattern", "HTTP", "https://shop.example.com/catalog", 150},
			{"Payment Gateway", "Payment authorize path", "JMeter", "https://pay.example.com/authorize", 100},
			{"Idle Smoke Scenario", "Ready-to-run smoke scenario", "HTTP", "https://api.example.com/v1/status", 10},
			{"TruClient Homepage", "Browser-level homepage load", "TruClient", "https://www.example.com/", 25},
		}
		for _, d := range demo {
			if _, err := tests.Create(ctx, uuid.New().String(), projectID, d.name, d.desc, d.script, d.url, d.vus); err != nil {
				return fmt.Errorf("seed test: %w", err)
			}
		}
		fmt.Println("[seed] created demo tests")
	}

	return nil
}
