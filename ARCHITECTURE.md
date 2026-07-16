# SpeedRunner Architecture Decisions

**Status:** Active (Phase 1–2 complete; Phase 3 parity continuing)  
**Last updated:** 2026-07-16

## Product identity

| Name | Role |
| --- | --- |
| **SpeedRunner** | Product / repo name |
| **MarathonRunner Enterprise** | Full platform vision in `Implementation/` |

## Source of truth

| Concern | Owner | Notes |
| --- | --- | --- |
| **API & control plane** | Go backend (`backend/`) | Auth, projects, tests, runs, schedules, SLA, templates, audit, API keys |
| **Metadata store** | PostgreSQL | Schema migrations in `internal/db/postgres.go` |
| **Runtime cache / live metrics** | Redis | Run status, live metric snapshots, pub/sub |
| **Artifacts** | MinIO / S3 + `MemoryStorage` | Memory store for local/dev; MinIO stub for prod path |
| **Portal UI** | Next.js (`frontend/`) | Thin client: REST + WebSocket demo mode |
| **Next.js `/api/*` + Prisma** | Legacy / BFF fallback | Prefer Go when `NEXT_PUBLIC_API_URL` is set |
| **Simulation engine** | `engine/simulate` (default) | Persists metrics every 1s; real engines: HTTP, JMeter, k6 scaffolds |

## Request flow (target)

```text
Browser
  → Next.js UI (Zustand)
  → REST  NEXT_PUBLIC_API_URL → Go API (:8080 /api/*)
  → WS    (Phase 2+) live metrics from control plane / Redis
  → Postgres (durable) + Redis (ephemeral)
  → Engine (simulate | HTTP | JMeter/k6 Jobs on K8s)
```

## Run modes

| Mode | How | Data path |
| --- | --- | --- |
| **UI demo only** | `cd frontend && npm run dev` | Mock store + local WS simulation in `server.ts` |
| **Full local stack** | `docker compose -f docker-compose.yml -f docker-compose.backend.yml up` | App + Redis + Postgres + Go API |
| **Control plane** | Postgres + Redis + `backend` binary | Real CRUD, JWT auth, audit, schedules, SLA |
| **API-backed UI** | `NEXT_PUBLIC_API_URL=http://localhost:8080` | Frontend talks to Go; mock hydrate disabled |

## Implemented control-plane API (v0.2.0)

| Area | Endpoints | Status |
| --- | --- | --- |
| Auth | `/api/auth/login`, `/register`, `/me` | Done |
| Projects | CRUD `/api/projects` | Done |
| Tests | CRUD + `/start` + `/stop` | Done (+ simulate engine) |
| Runs | List/create/get/stop/metrics | Done (+ metric ticks) |
| Schedules | CRUD `/api/schedules` + 30s poll loop | Done |
| SLA | Thresholds + results + auto-eval on stop | Done |
| Templates | CRUD + `/apply` | Done |
| API keys | Create/list/delete | Done |
| Webhooks | Register/list/delete + lifecycle events | Done (in-memory) |
| Cost | `POST /api/cost/estimate` | Done |
| AI | `POST /api/ai/recommend`, `/ai/anomaly` | Done (statistical) |
| Regions | `GET /api/regions` | Done (registry) |
| OpenAPI | `GET /api/openapi.json` | Done |
| Audit | `GET /api/audit` | Done |
| Live metrics | `GET /api/runs/live`, `/runs/{id}/live` | Done |
| Execution | `GET /api/execution/status`, `/execution/jobs` | Done |
| Dashboard | `GET /api/dashboard/summary` | Done |
| Environments | CRUD `/api/environments` | Done |
| LG pools | List/create + reserve `/api/pools` | Done |
| Applications | List/create `/api/applications` | Done |
| Reports | List/create/get `/api/reports` | Done |

## Backend packages

| Package | Role |
| --- | --- |
| `server` | HTTP API, runner orchestrator, schedule loop |
| `db/queries` | Users, projects, tests, runs, schedules, SLA, templates, API keys, audit |
| `engine/simulate` | Bounded random-walk live metrics |
| `engine/httpengine` | Real HTTP load (dev/light) |
| `engine/jmeter`, `engine/k6` | K8s job scaffolds |
| `controller` | Run lifecycle state machine |
| `scheduler` | In-memory schedule helpers + capacity/approval |
| `policy` | Execution guardrails |
| `results` | Parse/aggregate/evaluate |
| `k8s` | Jobs, pods, cleanup |
| `cost` | Run cost estimator |
| `ai` | Anomaly detection + load profile recommendations |
| `telemetry` | W3C correlation IDs |
| `integrations` | Webhook dispatcher |
| `chatops` | Slack/Teams command parser |
| `cicd` | Pipeline event registry |
| `region` | Multi-region capacity registry |
| `impact` | Bottleneck correlation |
| `api` | OpenAPI document |
| `storage` | Object storage interface + memory impl |

## Default credentials (local seed)

- Email: `admin@speedrunner.local`
- Password: `admin123`
- Role: `PLATFORM_ADMIN`

## JSON contract

API responses use **camelCase** (`projectId`, `virtualUsers`, `avgResponseTime`).

Auth: `Authorization: Bearer <jwt>`  
Roles: `PLATFORM_ADMIN`, `PERFORMANCE_LEAD`, `PERFORMANCE_ENGINEER`, `DEVELOPER`, `QA`, `RELEASE_MANAGER`, `READ_ONLY`, `SERVICE_ACCOUNT`

## Engine modes (`ENGINE_MODE`)

| Mode | Behavior |
| --- | --- |
| `simulate` | In-process metric simulation (default, no cluster needed) |
| `http` | Real HTTP load from the backend process (capped VUs) |
| `jmeter` | Kubernetes Job + ConfigMap test plan |
| `k6` | Kubernetes Job + generated k6 script |
| `auto` | Pick engine from test `scriptType` (JMeter→jmeter, k6→k6, HTTP→http) |

K8s engines require kubeconfig or in-cluster config. Without K8s, auto falls back to simulate.

Live metrics: always available via simulate companion ticks while K8s jobs run.  
Poll: `GET /api/runs/live` and `GET /api/runs/{id}/live`.

## Frontend ↔ Go integration

Set `NEXT_PUBLIC_API_URL=http://localhost:8080` on the Next.js app.

| Concern | Behavior |
| --- | --- |
| Auth | Login/JWT against Go; token in localStorage |
| Hydrate | tests, runs, SLA, templates, schedules from API |
| Actions | create/start/stop/delete tests via REST |
| Live charts | `useApiMetrics` polls `/api/runs/live` every 1s |
| WS | Disabled when Go API is configured |
| Banner | Shows engine mode + K8s readiness |

## Phase roadmap (Implementation/32 §7 + Better Features §4)

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | MVP enterprise platform | **complete** |
| 2 | LoadRunner-class parity | **complete** |
| 3 | UX multi-page portal | **complete** |
| **4.1** | Multi-engine (JMeter/k6/Gatling/Locust/Playwright) | **complete** |
| **4.2** | K8s Operator CRDs + in-process reconciler | **complete** |
| **4.3** | KEDA ScaledObjects + recommend API | **complete** |
| **4.4** | AI multi-metric anomaly detection | **complete** |
| **4.5** | Bottleneck correlation API | **complete** |
| **4.6** | GitOps export/import/drift | **complete** |
| **4.7** | Multi-region registry (capacity pick) | **complete** |
| **4.8** | Cost-aware schedule recommendations | **complete** |
| **4.9** | Self-service test data pools | **complete** |
| **4.10** | OpenTelemetry correlation middleware | **complete** |
| 5+ | Chargeback, ChatOps persistence, real OTEL export, chaos | next |

### Phase 4 API map

| API | Purpose |
| --- | --- |
| `GET /api/engines` | Engine catalog |
| `GET/POST /api/operator/runs` | Declarative TestRun reconcile |
| `GET /api/keda/recommend` | Scale recommendations + sample YAML |
| `POST /api/ai/anomaly/multi` | Multi-metric anomalies |
| `POST /api/impact/correlate` | Bottleneck ranking |
| `GET /api/gitops/tests/{id}` | Export YAML/JSON |
| `POST /api/gitops/tests/import` | Import manifest |
| `POST /api/cost/schedule-recommend` | Cost + window + region |
| `GET/POST /api/data-pools` | Test data pools + preload |
| Headers `Traceparent` / `X-Trace-Id` / `X-Run-Id` | OTEL correlation |

## Deferred UI modules (mock / localStorage)

Until APIs land for them, these remain client-only:

- Full CI/CD pipeline UI wiring
- Collaboration / team workspaces
- Security 2FA panels
- Advanced AI charts beyond `/api/ai/*`

See `Implementation/32-Full-Project-Implementation-Backlog.md` for the full epic list.
