package db

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/belo/speedrunner/backend/internal/db/queries"
)

// SeedDefaults creates admin user, default project, sample SLA thresholds and templates.
func SeedDefaults(ctx context.Context, pg *Postgres) error {
	users := queries.NewUserQueries(pg.Pool)
	projects := queries.NewProjectQueries(pg.Pool)
	sla := queries.NewSLAQueries(pg.Pool)
	templates := queries.NewTemplateQueries(pg.Pool)

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
		fmt.Println("[seed] created admin user admin@speedrunner.local / admin123")
	}

	var projectID string
	plist, err := projects.List(ctx)
	if err != nil {
		return fmt.Errorf("list projects: %w", err)
	}
	if len(plist) == 0 {
		p, err := projects.Create(ctx, uuid.New().String(), "Default Project", "Default SpeedRunner project")
		if err != nil {
			return fmt.Errorf("seed default project: %w", err)
		}
		projectID = p.ID
		fmt.Println("[seed] created Default Project")
	} else {
		projectID = plist[0].ID
	}

	// Seed SLA thresholds if none exist
	existingSLA, err := sla.ListThresholds(ctx, projectID)
	if err != nil {
		return fmt.Errorf("list sla: %w", err)
	}
	if len(existingSLA) == 0 {
		seeds := []struct {
			name, metric, cond string
			value              float64
		}{
			{"Max Avg Response Time", "avg_response_time", "lte", 500},
			{"Max Error Rate", "error_rate", "lte", 5},
			{"Min Throughput", "throughput", "gte", 10},
			{"Max P95 Latency", "p95", "lte", 1000},
		}
		for _, s := range seeds {
			if _, err := sla.CreateThreshold(ctx, uuid.New().String(), projectID, s.name, s.metric, s.cond, s.value); err != nil {
				return fmt.Errorf("seed sla %s: %w", s.name, err)
			}
		}
		fmt.Println("[seed] created default SLA thresholds")
	}

	// Seed templates if none exist
	existingTmpl, err := templates.List(ctx, projectID)
	if err != nil {
		return fmt.Errorf("list templates: %w", err)
	}
	if len(existingTmpl) == 0 {
		type tmplSeed struct {
			name, desc, script, url string
			vus                     int
		}
		tmpls := []tmplSeed{
			{"API Smoke", "Light smoke test for APIs", "HTTP", "https://api.example.com/health", 10},
			{"Login Load", "Login flow load profile", "JMeter", "https://app.example.com/login", 100},
			{"Checkout Stress", "Checkout stress scenario", "k6", "https://shop.example.com/checkout", 250},
		}
		for _, t := range tmpls {
			if _, err := templates.Create(ctx, uuid.New().String(), projectID, t.name, t.desc, t.script, t.url, t.vus); err != nil {
				return fmt.Errorf("seed template %s: %w", t.name, err)
			}
		}
		fmt.Println("[seed] created default test templates")
	}

	return nil
}
