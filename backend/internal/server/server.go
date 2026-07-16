package server

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/belo/speedrunner/backend/internal/config"
)

type Server struct {
	Router *chi.Mux
	Config *config.Config
}

func New(cfg *config.Config) *Server {
	s := &Server{
		Router: chi.NewRouter(),
		Config: cfg,
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
			r.Get("/me", s.meHandler)
		})

		r.Group(func(r chi.Router) {
			r.Use(s.authMiddleware)

			r.Route("/projects", func(r chi.Router) {
				r.Get("/", s.listProjectsHandler)
				r.Post("/", s.createProjectHandler)
				r.Get("/{id}", s.getProjectHandler)
				r.Put("/{id}", s.updateProjectHandler)
				r.Delete("/{id}", s.deleteProjectHandler)
			})

			r.Route("/tests", func(r chi.Router) {
				r.Get("/", s.listTestsHandler)
				r.Post("/", s.createTestHandler)
				r.Get("/{id}", s.getTestHandler)
				r.Put("/{id}", s.updateTestHandler)
				r.Delete("/{id}", s.deleteTestHandler)
				r.Post("/{id}/start", s.startTestHandler)
				r.Post("/{id}/stop", s.stopTestHandler)
			})

			r.Route("/runs", func(r chi.Router) {
				r.Get("/", s.listRunsHandler)
				r.Post("/", s.createRunHandler)
				r.Get("/{id}", s.getRunHandler)
				r.Post("/{id}/stop", s.stopRunHandler)
				r.Get("/{id}/metrics", s.getRunMetricsHandler)
			})

			r.Route("/schedules", func(r chi.Router) {
				r.Get("/", s.listSchedulesHandler)
				r.Post("/", s.createScheduleHandler)
				r.Put("/{id}", s.updateScheduleHandler)
				r.Delete("/{id}", s.deleteScheduleHandler)
			})

			r.Route("/sla", func(r chi.Router) {
				r.Get("/thresholds", s.listSLAThresholdsHandler)
				r.Post("/thresholds", s.createSLAThresholdHandler)
				r.Get("/results", s.listSLAResultsHandler)
			})

			r.Route("/templates", func(r chi.Router) {
				r.Get("/", s.listTemplatesHandler)
				r.Post("/", s.createTemplateHandler)
			})

			r.Route("/audit", func(r chi.Router) {
				r.Get("/", s.listAuditLogsHandler)
			})
		})
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
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
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
}

func (s *Server) ListenAndServe() error {
	addr := fmt.Sprintf("%s:%d", s.Config.Server.Host, s.Config.Server.Port)
	fmt.Printf("[server] Starting on %s\n", addr)
	return http.ListenAndServe(addr, s.Router)
}
