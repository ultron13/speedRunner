# SpeedRunner Architecture Decisions

**Status:** Active — enterprise vertical slice hardening  
**Last updated:** 2026-07-17

## Product identity

| Name | Role |
| --- | --- |
| **SpeedRunner** | Product / repo name |
| **MarathonRunner Enterprise** | Full platform vision in `Implementation/` |

## Source of truth

| Concern | Owner | Notes |
| --- | --- | --- |
| **API & control plane** | Go backend (`backend/`) | Auth, projects, tests, runs, schedules, SLA, templates, audit, enterprise APIs |
| **Metadata store** | PostgreSQL | Migrations in `internal/db/postgres.go` (users, tenants, runs, artifacts…) |
| **Runtime cache / live metrics** | Redis | Run status, live metric snapshots, pub/sub |
| **Artifacts** | File storage (`ARTIFACT_DIR`) + optional MinIO stub | Summary JSON written on run stop |
| **Portal UI** | Next.js (`frontend/`) | Thin client: REST when `NEXT_PUBLIC_API_URL` set; mock otherwise |
| **Next.js `/api/*` + Prisma** | Legacy / BFF fallback | Prefer Go for production |
| **Simulation engine** | `engine/simulate` (default) | Real engines: HTTP, JMeter/k6 Jobs on K8s when available |

## Target user journey (vertical slice)

```text
Login (password JWT | OIDC)
  → Create test
  → Start run (ENGINE_MODE=simulate | http | jmeter | k6 | auto)
  → Live metrics (Redis + /api/runs/live poll)
  → Stop / job complete → final metrics + SLA + artifact summary.json
  → Optional Jira defect (failed / high error rate)
  → Report / artifact list
  → Deploy via CI + Helm / minikube
```

## Request flow

```text
Browser
  → Next.js UI (Zustand)
  → REST  NEXT_PUBLIC_API_URL → Go API (:8080 /api/*)
  → Postgres (durable) + Redis (ephemeral)
  → Engine (simulate | HTTP | JMeter/k6 Jobs on K8s)
  → Artifacts under ARTIFACT_DIR (and run_artifacts table)
```

## Run modes

| Mode | How | Data path |
| --- | --- | --- |
| **UI demo only** | `cd frontend && npm run dev` | Mock store + local WS simulation |
| **Full local stack** | compose + Go backend | Real CRUD, JWT, audit, schedules, SLA |
| **API-backed UI** | `NEXT_PUBLIC_API_URL=http://localhost:8080` | Frontend talks to Go |
| **Cluster** | `make k8s-deploy` | Helm: app + backend + postgres + redis; `ENGINE_MODE=auto` |

## Identity & directory

| Path | Behavior |
| --- | --- |
| Password login | `/api/auth/login` → JWT; disabled/SSO-only accounts rejected |
| OIDC | `/api/auth/oidc/*`; DemoMode if no issuer; **UpsertOIDC** into Postgres |
| SCIM 2.0 | `/api/scim/v2/Users`; list/create/patch prefer **Postgres users** |

## Catalog breadth vs depth

See `PHASES.md` (~391 catalog items: waves 7–14 + 21–41). Many phase handlers are pure domain APIs; **core enterprise path** is the vertical slice above (durable identity, runs, artifacts, Jira, deploy).

## Implemented control-plane highlights

| Area | Status |
| --- | --- |
| Auth / OIDC / SCIM | Done (durable users) |
| Projects / Tests / Runs | Done (+ simulate metrics) |
| Schedules / SLA / Templates | Done |
| Artifacts on stop | Done (file store + DB index) |
| Jira defect-from-run | Done (demo or real token) |
| Tenants | Done (Postgres `tenants`) |
| K8s engines | Available when client-go connects |
| MinIO SDK | Stub; use `ARTIFACT_DIR` file store |

## Backend packages (selected)

| Package | Role |
| --- | --- |
| `server` | HTTP API, runner orchestrator, schedule loop |
| `db/queries` | Users, tenants, projects, tests, runs, artifacts, … |
| `storage` | FileStorage (durable), MemoryStorage, MinIO stub |
| `auth` / `scim` / `integrations/jira` | Enterprise identity + ITSM |
| `platform` | Phase domain logic (7–14, 21–41) |
| `engine/*` | simulate, http, jmeter, k6, … |

## Docs map

| Doc | Use |
| --- | --- |
| **This file** | Architecture truth |
| **PHASES.md** | API catalog / wave map |
| **LOADRUNNER_IMPLEMENTATION.md** | Historical client MVP notes (see header) |
| **Implementation/** | Long-range MarathonRunner vision |
