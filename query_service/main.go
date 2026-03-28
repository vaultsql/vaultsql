package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"gitlab.com/vaultsql/query_service/config"
	"gitlab.com/vaultsql/query_service/drivers"
	"gitlab.com/vaultsql/query_service/handlers"
	"gitlab.com/vaultsql/query_service/middleware"
)

func main() {
	cfg := config.Load()
	defer config.FlushSentry()

	// Initialize SSH tunnel pool
	if err := drivers.InitTunnelPool(cfg.SSHPrivateKey); err != nil {
		config.Logger.Error("Failed to initialize SSH tunnel pool", "error", err)
		os.Exit(1)
	}
	if cfg.SSHPrivateKey != "" {
		config.Logger.Info("SSH tunnel pool initialized")
	}

	h := handlers.New(cfg)

	r := chi.NewRouter()
	r.Use(middleware.CORS)
	r.Use(middleware.RequestLogger)
	r.Use(middleware.Recoverer)

	r.Get("/health", h.HealthCheck)
	r.Post("/api/account/{account_id}/run", h.RunQuery)
	r.Post("/api/account/{account_id}/stream", h.StreamQuery)
	r.Post("/api/test-connection", h.TestConnection)

	addr := fmt.Sprintf(":%s", cfg.Port)
	srv := &http.Server{
		Addr:    addr,
		Handler: r,
	}

	go func() {
		config.Logger.Info("Starting query service", "addr", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			config.Logger.Error("Server error", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	config.Logger.Info("Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		config.Logger.Error("Server forced to shutdown", "error", err)
		os.Exit(1)
	}

	// Close SSH tunnel pool
	if pool := drivers.GetTunnelPool(); pool != nil {
		pool.Close()
		config.Logger.Info("SSH tunnel pool closed")
	}

	config.Logger.Info("Server exited")
}
