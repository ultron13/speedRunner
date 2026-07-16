package server

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/belo/speedrunner/backend/internal/config"
	"github.com/belo/speedrunner/backend/internal/db"
	"github.com/belo/speedrunner/backend/internal/db/queries"
	redisclient "github.com/belo/speedrunner/backend/internal/redis"
)

type Server struct {
	Router   *chi.Mux
	Config   *config.Config
	DB       *db.Postgres
	Redis    *redisclient.RedisClient
	Users    *queries.UserQueries
	Projects *queries.ProjectQueries
	Tests    *queries.TestQueries
	Runs     *queries.RunQueries
	Audit    *queries.AuditQueries
}

type Deps struct {
	Config *config.Config
	DB     *db.Postgres
	Redis  *redisclient.RedisClient
}

func New(deps Deps) *Server {
	s := &Server{
		Router: chi.NewRouter(),
		Config: deps.Config,
		DB:     deps.DB,
		Redis:  deps.Redis,
	}
	if deps.DB != nil {
		pool := deps.DB.Pool
		s.Users = queries.NewUserQueries(pool)
		s.Projects = queries.NewProjectQueries(pool)
		s.Tests = queries.NewTestQueries(pool)
		s.Runs = queries.NewRunQueries(pool)
		s.Audit = queries.NewAuditQueries(pool)
	}
	s.setupMiddleware()
	s.setupRoutes()
	return s
}

func (s *Server) setupMiddleware() {
	s.Router.Use(chimw.RequestID)
	s.Router.Use(chimw.RealIP)
	s.Router.Use(chimw.Logger)
	s.Router.Use(chimw.Recoverer)
	s.Router.Use(chimw.Heartbeat("/ping"))
	s.Router.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		ExposedHeaders:   []string{"X-Request-Id"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
}

func (s *Server) setupRoutes() {
	s.Router.Get("/health", s.healthHandler)
	s.Router.Get("/ready", s.readyHandler)

	s.Router.Route("/api", func(r chi.Router) {
		r.Route("/auth", func(r chi.Router) {
			r.Post("/login", s.loginHandler)
			r.Post("/register", s.registerHandler)
			r.With(s.authMiddleware).Get("/me", s.meHandler)
		})

		r.Group(func(r chi.Router) {
			r.Use(s.authMiddleware)

			r.Route("/projects", func(r chi.Router) {
				r.With(s.requirePermission("project:read")).Get("/", s.listProjectsHandler)
				r.With(s.requirePermission("project:write")).Post("/", s.createProjectHandler)
				r.With(s.requirePermission("project:read")).Get("/{id}", s.getProjectHandler)
				r.With(s.requirePermission("project:write")).Put("/{id}", s.updateProjectHandler)
				r.With(s.requirePermission("project:write")).Delete("/{id}", s.deleteProjectHandler)
			})

			r.Route("/tests", func(r chi.Router) {
				r.With(s.requirePermission("test:read")).Get("/", s.listTestsHandler)
				r.With(s.requirePermission("test:write")).Post("/", s.createTestHandler)
				r.With(s.requirePermission("test:read")).Get("/{id}", s.getTestHandler)
				r.With(s.requirePermission("test:write")).Put("/{id}", s.updateTestHandler)
				r.With(s.requirePermission("test:write")).Delete("/{id}", s.deleteTestHandler)
				r.With(s.requirePermission("test:execute")).Post("/{id}/start", s.startTestHandler)
				r.With(s.requirePermission("test:execute")).Post("/{id}/stop", s.stopTestHandler)
			})

			r.Route("/runs", func(r chi.Router) {
				r.With(s.requirePermission("run:read")).Get("/", s.listRunsHandler)
				r.With(s.requirePermission("run:execute")).Post("/", s.createRunHandler)
				r.With(s.requirePermission("run:read")).Get("/{id}", s.getRunHandler)
				r.With(s.requirePermission("run:execute")).Post("/{id}/stop", s.stopRunHandler)
				r.With(s.requirePermission("run:read")).Get("/{id}/metrics", s.getRunMetricsHandler)
			})

			r.Route("/schedules", func(r chi.Router) {
				r.With(s.requirePermission("schedule:read")).Get("/", s.listSchedulesHandler)
				r.With(s.requirePermission("schedule:write")).Post("/", s.createScheduleHandler)
				r.With(s.requirePermission("schedule:write")).Put("/{id}", s.updateScheduleHandler)
				r.With(s.requirePermission("schedule:write")).Delete("/{id}", s.deleteScheduleHandler)
			})

			r.Route("/sla", func(r chi.Router) {
				r.With(s.requirePermission("sla:read")).Get("/thresholds", s.listSLAThresholdsHandler)
				r.With(s.requirePermission("sla:write")).Post("/thresholds", s.createSLAThresholdHandler)
				r.With(s.requirePermission("sla:read")).Get("/results", s.listSLAResultsHandler)
			})

			r.Route("/templates", func(r chi.Router) {
				r.With(s.requirePermission("test:read")).Get("/", s.listTemplatesHandler)
				r.With(s.requirePermission("test:write")).Post("/", s.createTemplateHandler)
			})

			r.Route("/audit", func(r chi.Router) {
				r.With(s.requirePermission("audit:read")).Get("/", s.listAuditLogsHandler)
			})
		})
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func (s *Server) healthHandler(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":  "healthy",
		"service": "speedrunner-backend",
		"version": "0.1.0",
	})
}

func (s *Server) readyHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	if s.DB != nil {
		if err := s.DB.Pool.Ping(ctx); err != nil {
			writeError(w, http.StatusServiceUnavailable, "database not ready")
			return
		}
	}
	if s.Redis != nil {
		if err := s.Redis.Ping(ctx); err != nil {
			writeError(w, http.StatusServiceUnavailable, "redis not ready")
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
}

func (s *Server) ListenAndServe() error {
	addr := fmt.Sprintf("%s:%d", s.Config.Server.Host, s.Config.Server.Port)
	fmt.Printf("[server] Starting on %s\n", addr)
	return http.ListenAndServe(addr, s.Router)
}
