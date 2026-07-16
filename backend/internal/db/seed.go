package db

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/belo/speedrunner/backend/internal/db/queries"
)

// SeedDefaults creates admin user and default project when the database is empty.
func SeedDefaults(ctx context.Context, pg *Postgres) error {
	users := queries.NewUserQueries(pg.Pool)
	projects := queries.NewProjectQueries(pg.Pool)

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

	pcount, err := projects.Count(ctx)
	if err != nil {
		return fmt.Errorf("count projects: %w", err)
	}
	if pcount == 0 {
		if _, err := projects.Create(ctx, uuid.New().String(), "Default Project", "Default SpeedRunner project"); err != nil {
			return fmt.Errorf("seed default project: %w", err)
		}
		fmt.Println("[seed] created Default Project")
	}

	return nil
}
