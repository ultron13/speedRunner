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
	"github.com/belo/speedrunner/backend/internal/auth"
	"github.com/belo/speedrunner/backend/internal/chatops"
	"github.com/belo/speedrunner/backend/internal/config"
	"github.com/belo/speedrunner/backend/internal/cost"
	"github.com/belo/speedrunner/backend/internal/db"
	"github.com/belo/speedrunner/backend/internal/db/queries"
	"github.com/belo/speedrunner/backend/internal/enterprise"
	"github.com/belo/speedrunner/backend/internal/impact"
	"github.com/belo/speedrunner/backend/internal/integrations"
	"github.com/belo/speedrunner/backend/internal/integrations/jira"
	k8sclient "github.com/belo/speedrunner/backend/internal/k8s"
	"github.com/belo/speedrunner/backend/internal/operator"
	"github.com/belo/speedrunner/backend/internal/platform"
	"github.com/belo/speedrunner/backend/internal/policy"
	redisclient "github.com/belo/speedrunner/backend/internal/redis"
	"github.com/belo/speedrunner/backend/internal/region"
	"github.com/belo/speedrunner/backend/internal/scim"
	"github.com/belo/speedrunner/backend/internal/testdata"
	"github.com/belo/speedrunner/backend/internal/telemetry"
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
	Impact       *impact.Correlator
	Operator     *operator.Reconciler
	DataPools    *testdata.Manager
	ChatOps      *chatops.Service
	Policy       *policy.PolicyEngine
	Virtual      *enterprise.VirtualRegistry
	Baselines     *enterprise.BaselineStore
	Quotas        *enterprise.QuotaStore
	Flags         *platform.FeatureFlags
	Maintenance   platform.MaintenanceWindow
	ExecWindows   []platform.TimeWindow
	Approvals     *platform.ApprovalStore
	Notifications *platform.NotificationBus
	Artifacts     *platform.ArtifactStore
	Limiter       *platform.RateLimiter
	// Phase 8 advanced ops
	Outbox      *platform.Outbox
	Idempotency *platform.IdempotencyStore
	SoftDelete  *platform.SoftDeleter
	Circuit     *platform.CircuitBreaker
	FairQueue   *platform.FairQueue
	UserPrefs   *platform.UserPrefsStore
	Org         *platform.OrgStore
	// Phase 9 resilience / observability
	Synthetics *platform.SyntheticStore
	// Phase 10 — EPE 25.3 parity
	Splunk         *platform.SplunkStore
	OTEL           *platform.OTELExporter
	Runtime        *platform.RuntimeController
	AWSTemplates   *platform.AWSTemplateStore
	PasswordForce  *platform.PasswordForceStore
	Vault          *platform.VaultStore
	PasswordPolicy platform.PasswordPolicy
	// Phase 11–13 SaaS / CI / edge
	Tenants     *platform.TenantStore
	Marketplace *platform.Marketplace
	SCIM        *platform.SCIMStore
	Meter       *platform.MeterStore
	ChaosRuns   *platform.ChaosStore
	Connectors  *platform.ConnectorHub
	Deliveries  *platform.DeliveryLedger
	// Real adapters
	OIDC      *auth.OIDCProvider
	Jira      *jira.Client
	SCIMUsers *scim.Store
	// Phase 14
	Annotations *platform.AnnotationStore
	DeadLetters *platform.DeadLetterQueue
	httpSrv     *http.Server
	cancelOps   context.CancelFunc
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
		Webhooks:  integrations.NewDispatcher(),
		Cost:      cost.NewDefault(),
		AI:        ai.NewDetector(),
		Regions:   region.NewRegistry(),
		Impact:    impact.NewCorrelator(),
		DataPools: testdata.NewManager(deps.Redis),
		Virtual:       enterprise.NewVirtualRegistry(),
		Baselines:     enterprise.NewBaselineStore(),
		Quotas:        enterprise.NewQuotaStore(),
		Policy:        policy.DefaultEnterpriseEngine(10000),
		Flags:         platform.NewFeatureFlags(),
		Approvals:     platform.NewApprovalStore(),
		Notifications: platform.NewNotificationBus(),
		Artifacts:     platform.NewArtifactStore(),
		Limiter:       platform.NewRateLimiter(50, 100),
		Outbox:        platform.NewOutbox(),
		Idempotency:   platform.NewIdempotencyStore(24 * time.Hour),
		SoftDelete:    platform.NewSoftDeleter(),
		Circuit:       platform.NewCircuitBreaker(5, 30*time.Second),
		FairQueue:     platform.NewFairQueue(),
		UserPrefs:     platform.NewUserPrefsStore(),
		Org:           platform.NewOrgStore(),
		Synthetics:     platform.NewSyntheticStore(),
		Splunk:         platform.NewSplunkStore(),
		OTEL:           platform.NewOTELExporter(),
		Runtime:        platform.NewRuntimeController(),
		AWSTemplates:   platform.NewAWSTemplateStore(),
		PasswordForce:  platform.NewPasswordForceStore(),
		Vault:          platform.NewVaultStore(),
		PasswordPolicy: platform.DefaultPasswordPolicy(),
		Tenants:        platform.NewTenantStore(),
		Marketplace:    platform.NewMarketplace(),
		SCIM:           platform.NewSCIMStore(),
		Meter:          platform.NewMeterStore(),
		ChaosRuns:      platform.NewChaosStore(),
		Connectors:     platform.NewConnectorHub(),
		Deliveries:     platform.NewDeliveryLedger(),
		SCIMUsers:      scim.NewStore("/api/scim/v2"),
		Annotations:    platform.NewAnnotationStore(),
		DeadLetters:    platform.NewDeadLetterQueue(),
	}
	if deps.Config != nil {
		s.Policy = policy.DefaultEnterpriseEngine(deps.Config.Engine.MaxVUs)
		s.OIDC = auth.NewOIDCProvider(auth.OIDCConfig{
			Issuer:       deps.Config.OIDC.Issuer,
			ClientID:     deps.Config.OIDC.ClientID,
			ClientSecret: deps.Config.OIDC.ClientSecret,
			RedirectURL:  deps.Config.OIDC.RedirectURL,
			DemoMode:     deps.Config.OIDC.DemoMode,
			Scopes:       []string{"openid", "profile", "email"},
		})
		s.Jira = jira.New(jira.Config{
			BaseURL:  deps.Config.Jira.BaseURL,
			Email:    deps.Config.Jira.Email,
			APIToken: deps.Config.Jira.APIToken,
			DemoMode: deps.Config.Jira.DemoMode,
		})
	} else {
		s.OIDC = auth.NewOIDCProvider(auth.OIDCConfig{DemoMode: true, ClientID: "demo", RedirectURL: "http://localhost:8080/api/auth/oidc/callback"})
		s.Jira = jira.New(jira.Config{DemoMode: true})
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
		// Kubernetes-style operator reconciler (in-process)
		s.Operator = operator.NewReconciler(&runnerExecutor{runner: s.Runner, tests: s.Tests})
		opsCtx, cancel := context.WithCancel(context.Background())
		s.cancelOps = cancel
		go s.Operator.Run(opsCtx)
		s.ChatOps = chatops.New(&chatopsBridge{s: s})
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
	s.Router.Use(telemetry.Middleware)
	s.Router.Use(s.rateLimitMiddleware)
	s.Router.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Trace-Id", "X-Request-Id", "X-Run-Id", "Traceparent"},
		ExposedHeaders:   []string{"X-Request-Id", "X-Trace-Id", "Traceparent"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
}

func (s *Server) rateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.Limiter != nil {
			key := clientIP(r)
			if !s.Limiter.Allow(key) {
				writeError(w, http.StatusTooManyRequests, "rate limit exceeded")
				return
			}
		}
		// API version headers on all responses
		for k, v := range platform.APIVersionHeaders("v1") {
			w.Header().Set(k, v)
		}
		if s.Maintenance.Active(time.Now()) && r.URL.Path != "/health" && r.URL.Path != "/ready" && r.URL.Path != "/metrics" {
			// Allow auth + health during maintenance; block mutations
			if r.Method != http.MethodGet && r.Method != http.MethodOptions && !strings.HasPrefix(r.URL.Path, "/api/auth") {
				msg := s.Maintenance.Message
				if msg == "" {
					msg = "platform is in maintenance mode"
				}
				writeError(w, http.StatusServiceUnavailable, msg)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) setupRoutes() {
	s.Router.Get("/health", s.healthHandler)
	s.Router.Get("/ready", s.readyHandler)
	s.Router.Get("/metrics", s.metricsPrometheusHandler)

	s.Router.Route("/api", func(r chi.Router) {
		r.Get("/openapi.json", s.openAPIHandler)

		r.Route("/auth", func(r chi.Router) {
			r.Post("/login", s.loginHandler)
			r.Post("/register", s.registerHandler)
			r.With(s.authMiddleware).Get("/me", s.meHandler)
			// OIDC (public)
			r.Get("/oidc/status", s.oidcStatusHandler)
			r.Get("/oidc/login", s.oidcLoginHandler)
			r.Get("/oidc/callback", s.oidcCallbackHandler)
		})

		// SCIM 2.0 (Bearer JWT admin or SCIM_TOKEN) — outside JWT middleware group
		r.Route("/scim/v2", func(r chi.Router) {
			r.Use(s.scimAuth)
			r.Get("/ServiceProviderConfig", s.scimServiceProviderConfig)
			r.Get("/Users", s.scimListUsers)
			r.Post("/Users", s.scimCreateUser)
			r.Get("/Users/{id}", s.scimGetUser)
			r.Put("/Users/{id}", s.scimReplaceUser)
			r.Patch("/Users/{id}", s.scimPatchUser)
			r.Delete("/Users/{id}", s.scimDeleteUser)
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

			// Phase 4.1–4.10 better-feature roadmap APIs
			r.With(s.requirePermission("test:read")).Get("/engines", s.listEnginesHandler)
			r.With(s.requirePermission("run:read")).Get("/keda/recommend", s.kedaRecommendHandler)
			r.With(s.requirePermission("run:read")).Post("/ai/anomaly/multi", s.aiMultiAnomalyHandler)
			r.With(s.requirePermission("run:read")).Post("/impact/correlate", s.correlateBottlenecksHandler)
			r.With(s.requirePermission("run:read")).Post("/cost/schedule-recommend", s.costScheduleRecommendHandler)

			r.Route("/operator/runs", func(r chi.Router) {
				r.With(s.requirePermission("run:read")).Get("/", s.listOperatorRunsHandler)
				r.With(s.requirePermission("run:execute")).Post("/", s.createOperatorRunHandler)
				r.With(s.requirePermission("run:read")).Get("/{name}", s.getOperatorRunHandler)
				r.With(s.requirePermission("run:execute")).Delete("/{name}", s.deleteOperatorRunHandler)
			})

			r.Route("/gitops", func(r chi.Router) {
				r.With(s.requirePermission("test:read")).Get("/tests/{id}", s.exportTestGitOpsHandler)
				r.With(s.requirePermission("test:write")).Post("/tests/import", s.importTestGitOpsHandler)
				r.With(s.requirePermission("test:read")).Post("/tests/{id}/drift", s.driftTestGitOpsHandler)
			})

			r.Route("/data-pools", func(r chi.Router) {
				r.With(s.requirePermission("test:read")).Get("/", s.listDataPoolsHandler)
				r.With(s.requirePermission("test:write")).Post("/", s.createDataPoolHandler)
				r.With(s.requirePermission("test:write")).Post("/{id}/preload", s.preloadDataPoolHandler)
				r.With(s.requirePermission("test:write")).Delete("/{id}", s.deleteDataPoolHandler)
			})

			// Phase 4.11–6.13 enterprise APIs
			r.With(s.requirePermission("test:execute")).Post("/chatops", s.chatopsHandler)
			r.With(s.requirePermission("test:read")).Post("/policy/evaluate", s.policyEvaluateHandler)
			r.With(s.requirePermission("test:read")).Post("/ai/script-review", s.aiScriptReviewHandler)
			r.With(s.requirePermission("test:read")).Post("/ai/generate-script", s.aiGenerateScriptHandler)
			r.With(s.requirePermission("test:read")).Post("/ai/data-pool-recommend", s.aiDataPoolRecommendHandler)
			r.With(s.requirePermission("test:read")).Post("/ai/synthetic-data", s.aiSyntheticDataHandler)
			r.With(s.requirePermission("run:read")).Post("/ai/run-summary", s.aiRunSummaryHandler)
			r.With(s.requirePermission("run:read")).Post("/ai/release-gate", s.aiReleaseGateHandler)
			r.With(s.requirePermission("run:read")).Post("/ai/capacity-forecast", s.aiCapacityForecastHandler)
			r.With(s.requirePermission("run:read")).Post("/ai/ops-assist", s.aiOpsAssistHandler)
			r.With(s.requirePermission("run:read")).Post("/ai/defect-draft", s.aiDefectDraftHandler)
			r.With(s.requirePermission("project:read")).Get("/readiness", s.readinessHandler)
			r.With(s.requirePermission("project:read")).Get("/virtual-services", s.listVirtualServicesHandler)
			r.With(s.requirePermission("project:write")).Post("/virtual-services", s.createVirtualServiceHandler)
			r.With(s.requirePermission("sla:read")).Get("/baselines", s.listBaselinesHandler)
			r.With(s.requirePermission("sla:write")).Post("/baselines", s.proposeBaselineHandler)
			r.With(s.requirePermission("sla:write")).Post("/baselines/approve", s.approveBaselineHandler)
			r.With(s.requirePermission("test:read")).Get("/golden-templates", s.goldenTemplatesHandler)
			r.With(s.requirePermission("test:read")).Post("/impact/analyze", s.impactAnalysisHandler)
			r.With(s.requirePermission("test:read")).Get("/chaos/catalog", s.chaosCatalogHandler)
			r.With(s.requirePermission("project:read")).Post("/residency/check", s.residencyCheckHandler)
			r.With(s.requirePermission("project:read")).Get("/quotas", s.listQuotasHandler)
			r.With(s.requirePermission("project:read")).Post("/quotas/check", s.checkQuotaHandler)
			r.With(s.requirePermission("admin:read")).Get("/cleanup/plan", s.cleanupPlanHandler)
			r.With(s.requirePermission("project:read")).Post("/env/drift", s.envDriftHandler)
			r.With(s.requirePermission("test:read")).Post("/contracts/validate", s.contractValidateHandler)

			// Phase 7.1–7.50 production platform APIs
			r.With(s.requirePermission("admin:read")).Get("/platform/flags", s.featureFlagsHandler)
			r.With(s.requirePermission("admin:write")).Post("/platform/flags", s.featureFlagsHandler)
			r.With(s.requirePermission("admin:read")).Get("/platform/maintenance", s.maintenanceHandler)
			r.With(s.requirePermission("admin:write")).Post("/platform/maintenance", s.maintenanceHandler)
			r.With(s.requirePermission("schedule:read")).Get("/platform/windows", s.executionWindowsHandler)
			r.With(s.requirePermission("schedule:write")).Post("/platform/windows", s.executionWindowsHandler)
			r.With(s.requirePermission("run:read")).Get("/approvals", s.listApprovalsHandler)
			r.With(s.requirePermission("run:execute")).Post("/approvals", s.createApprovalHandler)
			r.With(s.requirePermission("run:execute")).Post("/approvals/{id}/decide", s.decideApprovalHandler)
			r.With(s.requirePermission("run:read")).Post("/runs/compare", s.compareRunsHandler)
			r.With(s.requirePermission("run:read")).Post("/trends/aggregate", s.trendAggregateHandler)
			r.With(s.requirePermission("run:read")).Get("/notifications", s.notificationsHandler)
			r.With(s.requirePermission("run:execute")).Post("/notifications", s.notificationsHandler)
			r.With(s.requirePermission("run:read")).Get("/artifacts", s.artifactsHandler)
			r.With(s.requirePermission("run:execute")).Post("/artifacts", s.artifactsHandler)
			r.With(s.requirePermission("admin:read")).Post("/security/utils", s.securityUtilsHandler)
			r.With(s.requirePermission("run:read")).Post("/chargeback", s.chargebackHandler)
			r.With(s.requirePermission("admin:read")).Get("/retention", s.retentionHandler)
			r.With(s.requirePermission("test:read")).Get("/workloads", s.workloadsHandler)
			r.With(s.requirePermission("test:read")).Get("/journeys", s.journeysHandler)
			r.With(s.requirePermission("run:read")).Post("/release-board", s.releaseBoardHandler)
			r.With(s.requirePermission("project:read")).Get("/health-matrix", s.healthMatrixHandler)
			r.With(s.requirePermission("project:read")).Get("/platform/phases", s.platformPhasesHandler)

			// Phase 8.1–8.50 advanced enterprise operations APIs
			r.With(s.requirePermission("admin:read")).Get("/platform/outbox", s.outboxHandler)
			r.With(s.requirePermission("admin:write")).Post("/platform/outbox", s.outboxHandler)
			r.With(s.requirePermission("admin:read")).Post("/platform/webhooks/sign", s.webhookSignHandler)
			r.With(s.requirePermission("admin:write")).Post("/platform/idempotency", s.idempotencyHandler)
			r.With(s.requirePermission("admin:write")).Post("/platform/soft-delete", s.softDeleteHandler)
			r.With(s.requirePermission("run:read")).Post("/alerts/evaluate", s.alertEvaluateHandler)
			r.With(s.requirePermission("sla:read")).Post("/slo/status", s.sloStatusHandler)
			r.With(s.requirePermission("admin:read")).Post("/platform/circuit", s.circuitBreakerHandler)
			r.With(s.requirePermission("run:execute")).Post("/platform/watchdog", s.watchdogHandler)
			r.With(s.requirePermission("run:read")).Get("/platform/queue", s.fairQueueHandler)
			r.With(s.requirePermission("run:execute")).Post("/platform/queue", s.fairQueueHandler)
			r.With(s.requirePermission("test:read")).Post("/platform/ramp", s.progressiveRampHandler)
			r.With(s.requirePermission("run:read")).Post("/platform/budget", s.budgetStatusHandler)
			r.With(s.requirePermission("project:read")).Get("/platform/prefs", s.userPrefsHandler)
			r.With(s.requirePermission("project:write")).Post("/platform/prefs", s.userPrefsHandler)
			r.With(s.requirePermission("admin:read")).Post("/platform/classify", s.classifyDataHandler)
			r.With(s.requirePermission("audit:read")).Post("/platform/compliance-pack", s.compliancePackHandler)
			r.With(s.requirePermission("admin:read")).Get("/platform/org", s.orgHandler)
			r.With(s.requirePermission("admin:write")).Post("/platform/org", s.orgHandler)
			r.With(s.requirePermission("project:read")).Get("/platform/phases/8", s.platformPhases8Handler)
			r.With(s.requirePermission("project:read")).Get("/platform/phases/9", s.platformPhases9Handler)
			r.With(s.requirePermission("project:read")).Get("/platform/phases/10", s.platformPhases10Handler)
			r.With(s.requirePermission("project:read")).Get("/platform/phases/11", s.platformPhases11Handler)
			r.With(s.requirePermission("project:read")).Get("/platform/phases/12", s.platformPhases12Handler)
			r.With(s.requirePermission("project:read")).Get("/platform/phases/13", s.platformPhases13Handler)
			r.With(s.requirePermission("project:read")).Get("/platform/phases/14", s.platformPhases14Handler)
			r.With(s.requirePermission("project:read")).Get("/platform/phases/all", s.platformAllPhasesHandler)

			// Phase 14.1–14.20 enterprise extensions
			r.With(s.requirePermission("test:read")).Get("/workspace/templates", s.workspaceTemplatesHandler)
			r.With(s.requirePermission("admin:read")).Post("/security/secret-rotation", s.secretRotationHandler)
			r.With(s.requirePermission("run:read")).Get("/runs/annotations", s.runAnnotationsHandler)
			r.With(s.requirePermission("run:execute")).Post("/runs/annotations", s.runAnnotationsHandler)
			r.With(s.requirePermission("schedule:read")).Post("/platform/freeze", s.freezeWindowsHandler)
			r.With(s.requirePermission("test:read")).Post("/impact/dependencies", s.dependencyImpactHandler)
			r.With(s.requirePermission("run:read")).Post("/scorecard", s.scorecardHandler)
			r.With(s.requirePermission("project:read")).Post("/experiments/bucket", s.experimentBucketHandler)
			r.With(s.requirePermission("audit:read")).Post("/audit/export", s.auditExportHandler)
			r.With(s.requirePermission("admin:read")).Get("/webhooks/dead-letters", s.deadLetterHandler)
			r.With(s.requirePermission("admin:write")).Post("/webhooks/dead-letters", s.deadLetterHandler)
			r.With(s.requirePermission("test:read")).Post("/suites/order", s.suitePackHandler)
			r.With(s.requirePermission("run:execute")).Post("/env/promotion", s.promotionGateHandler)
			r.With(s.requirePermission("test:read")).Post("/security/secret-scan", s.secretScanHandler)
			r.With(s.requirePermission("admin:read")).Post("/security/ip-allowlist", s.ipAllowlistHandler)

			// Phase 11 — multi-tenant SaaS, marketplace, licensing
			r.With(s.requirePermission("admin:read")).Get("/tenants", s.tenantsHandler)
			r.With(s.requirePermission("admin:write")).Post("/tenants", s.tenantsHandler)
			r.With(s.requirePermission("admin:read")).Post("/license/validate", s.licenseValidateHandler)
			r.With(s.requirePermission("test:read")).Get("/marketplace", s.marketplaceHandler)
			r.With(s.requirePermission("test:write")).Post("/marketplace", s.marketplaceHandler)
			r.With(s.requirePermission("admin:read")).Get("/api-tiers", s.apiTiersHandler)
			r.With(s.requirePermission("admin:read")).Get("/sso/config", s.ssoConfigHandler)
			r.With(s.requirePermission("admin:write")).Post("/sso/config", s.ssoConfigHandler)
			r.With(s.requirePermission("admin:read")).Get("/scim/users", s.scimUsersHandler)
			r.With(s.requirePermission("admin:write")).Post("/scim/users", s.scimUsersHandler)
			r.With(s.requirePermission("admin:read")).Get("/usage", s.usageMeterHandler)
			r.With(s.requirePermission("admin:write")).Post("/usage", s.usageMeterHandler)

			// Phase 12 — CI gates, digital twin, chaos, journeys, budgets
			r.With(s.requirePermission("run:read")).Post("/ci/quality-gate", s.qualityGateHandler)
			r.With(s.requirePermission("run:read")).Post("/capacity/digital-twin", s.digitalTwinHandler)
			r.With(s.requirePermission("test:read")).Get("/chaos/scenarios", s.chaosAdvancedHandler)
			r.With(s.requirePermission("test:execute")).Post("/chaos/scenarios", s.chaosAdvancedHandler)
			r.With(s.requirePermission("test:read")).Post("/journeys/validate", s.browserJourneyHandler)
			r.With(s.requirePermission("run:read")).Post("/ci/perf-budget", s.perfBudgetHandler)

			// Phase 13 — edge/mobile, FinOps carbon, connectors
			r.With(s.requirePermission("project:read")).Get("/edge/locations", s.edgeLocationsHandler)
			r.With(s.requirePermission("test:read")).Post("/edge/mobile-network", s.mobileNetworkHandler)
			r.With(s.requirePermission("run:read")).Post("/finops/estimate", s.finopsHandler)
			r.With(s.requirePermission("admin:read")).Get("/connectors", s.connectorsHandler)
			r.With(s.requirePermission("admin:write")).Post("/connectors", s.connectorsHandler)
			r.With(s.requirePermission("admin:read")).Get("/webhooks/deliveries", s.deliveryLedgerHandler)
			r.With(s.requirePermission("admin:write")).Post("/webhooks/deliveries", s.deliveryLedgerHandler)

			// Real Jira adapter
			r.With(s.requirePermission("project:read")).Get("/integrations/jira/status", s.jiraStatusHandler)
			r.With(s.requirePermission("project:write")).Post("/integrations/jira/issues", s.jiraCreateIssueHandler)
			r.With(s.requirePermission("project:read")).Get("/integrations/jira/issues/{key}", s.jiraGetIssueHandler)
			r.With(s.requirePermission("project:read")).Post("/integrations/jira/search", s.jiraSearchHandler)
			r.With(s.requirePermission("run:execute")).Post("/integrations/jira/defect-from-run", s.jiraDefectFromRunHandler)

			// Phase 10 — OpenText EPE CE 25.3 parity (video features)
			r.With(s.requirePermission("test:read")).Post("/aviator", s.aviatorHandler)
			r.With(s.requirePermission("run:read")).Get("/integrations/splunk", s.splunkHandler)
			r.With(s.requirePermission("run:execute")).Post("/integrations/splunk", s.splunkHandler)
			r.With(s.requirePermission("admin:read")).Get("/integrations/otel", s.otelHandler)
			r.With(s.requirePermission("admin:write")).Post("/integrations/otel", s.otelHandler)
			r.With(s.requirePermission("run:read")).Get("/runs/{id}/runtime", s.runtimeRunHandler)
			r.With(s.requirePermission("run:execute")).Post("/runs/{id}/runtime", s.runtimeRunHandler)
			r.With(s.requirePermission("project:read")).Get("/cloud/aws-templates", s.awsTemplatesHandler)
			r.With(s.requirePermission("project:write")).Post("/cloud/aws-templates", s.awsTemplatesHandler)
			r.With(s.requirePermission("admin:read")).Get("/security/password-policy", s.passwordPolicyHandler)
			r.With(s.requirePermission("admin:write")).Post("/security/password-policy", s.passwordPolicyHandler)
			r.With(s.requirePermission("test:write")).Post("/integrations/vault/resolve", s.vaultResolveHandler)
			r.With(s.requirePermission("test:read")).Get("/protocols", s.protocolsHandler)
			r.With(s.requirePermission("test:read")).Post("/protocols", s.protocolsHandler)
			r.With(s.requirePermission("project:read")).Get("/platform/epe-25.3", s.epe253FeaturesHandler)

			// Phase 9.1–9.50 resilience, DR, observability, capacity
			r.With(s.requirePermission("project:read")).Post("/platform/regions/failover", s.regionFailoverHandler)
			r.With(s.requirePermission("admin:read")).Post("/platform/dr/evaluate", s.drEvaluateHandler)
			r.With(s.requirePermission("run:read")).Post("/platform/traces/sample", s.traceSampleHandler)
			r.With(s.requirePermission("project:read")).Get("/platform/synthetics", s.syntheticsHandler)
			r.With(s.requirePermission("project:write")).Post("/platform/synthetics", s.syntheticsHandler)
			r.With(s.requirePermission("run:read")).Post("/platform/canary/analyze", s.canaryAnalyzeHandler)
			r.With(s.requirePermission("admin:read")).Post("/platform/capacity/plan", s.capacityPlanHandler)
			r.With(s.requirePermission("admin:read")).Post("/platform/export-bundle", s.exportBundleHandler)
			r.With(s.requirePermission("project:read")).Post("/platform/rollout", s.rolloutHandler)

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
	if s.cancelOps != nil {
		s.cancelOps()
	}
	if s.httpSrv != nil {
		return s.httpSrv.Shutdown(ctx)
	}
	return nil
}
