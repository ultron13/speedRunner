# SpeedRunner Architecture Decisions

**Status:** Active (Phase 1 complete → Phase 2–3 in progress)  
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

## Phase roadmap

1. **Foundation (persist + auth)** — **complete**
2. **Real execution** — HTTP engine done; JMeter/k6 K8s jobs next
3. **LoadRunner parity** — schedules/SLA/templates done; pools & reporting next
4. **UX routes** — multi-page portal
5. **K8s depth** — operator, KEDA
6. **Observability + CI gates** — OTEL exporters, gate endpoints
7. **Real AI** — swap statistical detector for model-backed analysis
8. **Integrations / multi-region** — packages scaffolded; persistence next

## Deferred UI modules (mock / localStorage)

Until APIs land for them, these remain client-only:

- Full CI/CD pipeline UI wiring
- Collaboration / team workspaces
- Security 2FA panels
- Advanced AI charts beyond `/api/ai/*`

See `Implementation/32-Full-Project-Implementation-Backlog.md` for the full epic list.
