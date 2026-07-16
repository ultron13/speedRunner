package server

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/google/uuid"

	"github.com/belo/speedrunner/backend/internal/ai"
	"github.com/belo/speedrunner/backend/internal/config"
	"github.com/belo/speedrunner/backend/internal/cost"
	"github.com/belo/speedrunner/backend/internal/db"
	"github.com/belo/speedrunner/backend/internal/db/queries"
	"github.com/belo/speedrunner/backend/internal/integrations"
	k8sclient "github.com/belo/speedrunner/backend/internal/k8s"
	redisclient "github.com/belo/speedrunner/backend/internal/redis"
	"github.com/belo/speedrunner/backend/internal/region"
)

type Server struct {
	Router    *chi.Mux
	Config    *config.Config
	DB        *db.Postgres
	Redis     *redisclient.RedisClient
	K8s       *k8sclient.Client
	Users     *queries.UserQueries
	Projects  *queries.ProjectQueries
	Tests     *queries.TestQueries
	Runs      *queries.RunQueries
	Audit     *queries.AuditQueries
	Schedules *queries.ScheduleQueries
	SLA       *queries.SLAQueries
	Templates    *queries.TemplateQueries
	APIKeys      *queries.APIKeyQueries
	Environments *queries.EnvironmentQueries
	Pools        *queries.PoolQueries
	Applications *queries.ApplicationQueries
	Reports      *queries.ReportQueries
	Runner       *RunnerOrchestrator
	Webhooks     *integrations.Dispatcher
	Cost         *cost.Estimator
	AI           *ai.Detector
	Regions      *region.Registry
	httpSrv      *http.Server
}

type Deps struct {
	Config *config.Config
	DB     *db.Postgres
	Redis  *redisclient.RedisClient
	K8s    *k8sclient.Client
}

func New(deps Deps) *Server {
	s := &Server{
		Router:   chi.NewRouter(),
		Config:   deps.Config,
		DB:       deps.DB,
		Redis:    deps.Redis,
		K8s:      deps.K8s,
		Webhooks: integrations.NewDispatcher(),
		Cost:     cost.NewDefault(),
		AI:       ai.NewDetector(),
		Regions:  region.NewRegistry(),
	}
	if deps.DB != nil {
		pool := deps.DB.Pool
		s.Users = queries.NewUserQueries(pool)
		s.Projects = queries.NewProjectQueries(pool)
		s.Tests = queries.NewTestQueries(pool)
		s.Runs = queries.NewRunQueries(pool)
		s.Audit = queries.NewAuditQueries(pool)
		s.Schedules = queries.NewScheduleQueries(pool)
		s.SLA = queries.NewSLAQueries(pool)
		s.Templates = queries.NewTemplateQueries(pool)
		s.APIKeys = queries.NewAPIKeyQueries(pool)
		s.Environments = queries.NewEnvironmentQueries(pool)
		s.Pools = queries.NewPoolQueries(pool)
		s.Applications = queries.NewApplicationQueries(pool)
		s.Reports = queries.NewReportQueries(pool)
		mode := "simulate"
		jmImage, k6Image, ns := "", "", ""
		if deps.Config != nil {
			mode = deps.Config.Engine.Mode
			jmImage = deps.Config.Engine.JMeterImage
			k6Image = deps.Config.Engine.K6Image
			ns = deps.Config.K8s.ExecutionNS
		}
		s.Runner = NewRunnerOrchestrator(RunnerConfig{
			Mode:        mode,
			K8s:         deps.K8s,
			Namespace:   ns,
			JMeterImage: jmImage,
			K6Image:     k6Image,
			Runs:        s.Runs,
			Tests:       s.Tests,
			SLA:         s.SLA,
			Redis:       deps.Redis,
			Webhooks:    s.Webhooks,
		})
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
		r.Get("/openapi.json", s.openAPIHandler)

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
				r.With(s.requirePermission("run:read")).Get("/live", s.listLiveMetricsHandler)
				r.With(s.requirePermission("run:read")).Get("/{id}", s.getRunHandler)
				r.With(s.requirePermission("run:execute")).Post("/{id}/stop", s.stopRunHandler)
				r.With(s.requirePermission("run:read")).Get("/{id}/metrics", s.getRunMetricsHandler)
				r.With(s.requirePermission("run:read")).Get("/{id}/live", s.getLiveMetricHandler)
			})

			r.With(s.requirePermission("run:read")).Get("/execution/status", s.executionStatusHandler)
			r.With(s.requirePermission("run:read")).Get("/execution/jobs", s.listExecutionJobsHandler)

			r.With(s.requirePermission("run:read")).Get("/dashboard/summary", s.dashboardSummaryHandler)

			r.Route("/environments", func(r chi.Router) {
				r.With(s.requirePermission("project:read")).Get("/", s.listEnvironmentsHandler)
				r.With(s.requirePermission("project:write")).Post("/", s.createEnvironmentHandler)
				r.With(s.requirePermission("project:write")).Delete("/{id}", s.deleteEnvironmentHandler)
			})

			r.Route("/pools", func(r chi.Router) {
				r.With(s.requirePermission("project:read")).Get("/", s.listPoolsHandler)
				r.With(s.requirePermission("project:write")).Post("/", s.createPoolHandler)
			})

			r.Route("/applications", func(r chi.Router) {
				r.With(s.requirePermission("project:read")).Get("/", s.listApplicationsHandler)
				r.With(s.requirePermission("project:write")).Post("/", s.createApplicationHandler)
			})

			r.Route("/reports", func(r chi.Router) {
				r.With(s.requirePermission("run:read")).Get("/", s.listReportsHandler)
				r.With(s.requirePermission("run:read")).Post("/", s.createReportHandler)
				r.With(s.requirePermission("run:read")).Get("/{id}", s.getReportHandler)
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
				r.With(s.requirePermission("sla:write")).Delete("/thresholds/{id}", s.deleteSLAThresholdHandler)
				r.With(s.requirePermission("sla:read")).Get("/results", s.listSLAResultsHandler)
			})

			r.Route("/templates", func(r chi.Router) {
				r.With(s.requirePermission("test:read")).Get("/", s.listTemplatesHandler)
				r.With(s.requirePermission("test:write")).Post("/", s.createTemplateHandler)
				r.With(s.requirePermission("test:write")).Post("/{id}/apply", s.applyTemplateHandler)
				r.With(s.requirePermission("test:write")).Delete("/{id}", s.deleteTemplateHandler)
			})

			r.Route("/api-keys", func(r chi.Router) {
				r.With(s.requirePermission("test:read")).Get("/", s.listAPIKeysHandler)
				r.With(s.requirePermission("test:write")).Post("/", s.createAPIKeyHandler)
				r.With(s.requirePermission("test:write")).Delete("/{id}", s.deleteAPIKeyHandler)
			})

			r.Route("/webhooks", func(r chi.Router) {
				r.With(s.requirePermission("admin:read")).Get("/", s.listWebhooksHandler)
				r.With(s.requirePermission("admin:write")).Post("/", s.createWebhookHandler)
				r.With(s.requirePermission("admin:write")).Delete("/{id}", s.deleteWebhookHandler)
			})

			r.With(s.requirePermission("run:read")).Post("/cost/estimate", s.costEstimateHandler)
			r.With(s.requirePermission("test:read")).Post("/ai/recommend", s.aiRecommendHandler)
			r.With(s.requirePermission("run:read")).Post("/ai/anomaly", s.aiAnomalyHandler)
			r.With(s.requirePermission("project:read")).Get("/regions", s.listRegionsHandler)

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
	engines := []string{"simulate", "http"}
	mode := "simulate"
	k8sOK := false
	if s.Runner != nil {
		engines = s.Runner.Engines()
		mode = s.Runner.Mode()
		k8sOK = s.Runner.HasK8s()
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":  "healthy",
		"service": "speedrunner-backend",
		"version": "0.3.0",
		"engine": map[string]interface{}{
			"mode":    mode,
			"engines": engines,
			"k8s":     k8sOK,
		},
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

// StartScheduleLoop polls due schedules and starts tests.
func (s *Server) StartScheduleLoop(ctx context.Context) {
	if s.Schedules == nil || s.Tests == nil || s.Runs == nil {
		return
	}
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	log.Println("[scheduler] schedule loop started (30s poll)")
	for {
		select {
		case <-ctx.Done():
			log.Println("[scheduler] schedule loop stopped")
			return
		case <-ticker.C:
			s.processDueSchedules(ctx)
		}
	}
}

func (s *Server) processDueSchedules(parent context.Context) {
	ctx, cancel := context.WithTimeout(parent, 20*time.Second)
	defer cancel()

	due, err := s.Schedules.ListDue(ctx, time.Now())
	if err != nil {
		log.Printf("[scheduler] list due: %v", err)
		return
	}
	for _, sched := range due {
		test, err := s.Tests.Get(ctx, sched.TestID)
		if err != nil || test == nil {
			log.Printf("[scheduler] test %s not found for schedule %s", sched.TestID, sched.ID)
			next := ScheduleNextRun(sched.Frequency, time.Now())
			_ = s.Schedules.MarkExecuted(ctx, sched.ID, &next)
			continue
		}
		if strings.EqualFold(test.Status, "RUNNING") {
			next := ScheduleNextRun(sched.Frequency, time.Now())
			_ = s.Schedules.MarkExecuted(ctx, sched.ID, &next)
			continue
		}

		run, err := s.Runs.Create(ctx, uuid.New().String(), test.ID, "SCHEDULED", nil)
		if err != nil {
			log.Printf("[scheduler] create run: %v", err)
			continue
		}
		_ = s.Tests.UpdateStatus(ctx, test.ID, "RUNNING")
		_ = s.Tests.SetLastRun(ctx, test.ID)
		if s.Runner != nil {
			if err := s.Runner.Start(ctx, run.ID, test); err != nil {
				log.Printf("[scheduler] start runner: %v", err)
			}
		}
		next := ScheduleNextRun(sched.Frequency, time.Now())
		_ = s.Schedules.MarkExecuted(ctx, sched.ID, &next)
		log.Printf("[scheduler] started run %s for schedule %s (test %s)", run.ID, sched.ID, test.ID)
	}
}

func (s *Server) ListenAndServe() error {
	addr := fmt.Sprintf("%s:%d", s.Config.Server.Host, s.Config.Server.Port)
	s.httpSrv = &http.Server{Addr: addr, Handler: s.Router}
	fmt.Printf("[server] Starting on %s\n", addr)
	return s.httpSrv.ListenAndServe()
}

func (s *Server) Shutdown(ctx context.Context) error {
	if s.httpSrv != nil {
		return s.httpSrv.Shutdown(ctx)
	}
	return nil
}
