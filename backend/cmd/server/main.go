package main

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/belo/speedrunner/backend/internal/config"
	"github.com/belo/speedrunner/backend/internal/server"
)

func main() {
	cfg := config.Load()

	srv := server.New(cfg)

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
}
