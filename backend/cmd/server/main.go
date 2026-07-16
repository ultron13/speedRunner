package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/belo/speedrunner/backend/internal/config"
	"github.com/belo/speedrunner/backend/internal/db"
	redisclient "github.com/belo/speedrunner/backend/internal/redis"
	"github.com/belo/speedrunner/backend/internal/server"
)

func main() {
	cfg := config.Load()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// PostgreSQL (required for control plane)
	pg, err := db.NewPostgres(ctx, cfg.Database)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[fatal] database: %v\n", err)
		fmt.Fprintf(os.Stderr, "[hint] set DATABASE_URL and ensure Postgres is running\n")
		os.Exit(1)
	}
	defer pg.Close()

	if err := pg.RunMigrations(ctx); err != nil {
		fmt.Fprintf(os.Stderr, "[fatal] migrations: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("[db] migrations applied")

	if err := db.SeedDefaults(ctx, pg); err != nil {
		fmt.Fprintf(os.Stderr, "[fatal] seed: %v\n", err)
		os.Exit(1)
	}

	// Redis (optional but recommended)
	var rdb *redisclient.RedisClient
	rdb, err = redisclient.NewRedis(cfg.Redis)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[warn] redis client init: %v — continuing without redis\n", err)
		rdb = nil
	} else {
		pingCtx, pingCancel := context.WithTimeout(context.Background(), 3*time.Second)
		if err := rdb.Ping(pingCtx); err != nil {
			fmt.Fprintf(os.Stderr, "[warn] redis not reachable: %v — continuing without redis\n", err)
			_ = rdb.Close()
			rdb = nil
		} else {
			fmt.Println("[redis] connected")
		}
		pingCancel()
	}

	srv := server.New(server.Deps{
		Config: cfg,
		DB:     pg,
		Redis:  rdb,
	})

	go func() {
		if err := srv.ListenAndServe(); err != nil {
			fmt.Fprintf(os.Stderr, "[fatal] server error: %v\n", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	fmt.Println("\n[shutdown] shutting down gracefully...")
	if rdb != nil {
		_ = rdb.Close()
	}
}
