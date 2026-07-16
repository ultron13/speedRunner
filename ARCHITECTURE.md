# SpeedRunner Architecture Decisions

**Status:** Active (Phase 0–1)  
**Last updated:** 2026-07-16

## Product identity

| Name | Role |
| --- | --- |
| **SpeedRunner** | Product / repo name |
| **MarathonRunner Enterprise** | Full platform vision in `Implementation/` |

## Source of truth

| Concern | Owner | Notes |
| --- | --- | --- |
| **API & control plane** | Go backend (`backend/`) | Single system of record for auth, projects, tests, runs, SLA, audit |
| **Metadata store** | PostgreSQL | Schema migrations owned by Go (`internal/db/postgres.go`) |
| **Runtime cache / live metrics** | Redis | Run status, live metric snapshots, pub/sub |
| **Artifacts** | MinIO / S3 (Phase 5) | JTL, logs, reports — not required for Phase 1 |
| **Portal UI** | Next.js (`frontend/`) | Thin client: REST + WebSocket |
| **Next.js `/api/*` + Prisma** | Legacy / BFF fallback | Prefer Go when `NEXT_PUBLIC_API_URL` is set; do not diverge schemas long-term |
| **Simulation engine** | `ENGINE_MODE=simulate` (default until Phase 2) | Demo fallback only; not production load |

## Request flow (target)

```text
Browser
  → Next.js UI (Zustand)
  → REST  NEXT_PUBLIC_API_URL → Go API (:8080 /api/*)
  → WS    (Phase 2+) live metrics from control plane / Redis
  → Postgres (durable) + Redis (ephemeral)
  → Engine (HTTP local → JMeter/k6 Jobs on K8s)
```

## Run modes

| Mode | How | Data path |
| --- | --- | --- |
| **UI demo only** | `cd frontend && npm run dev` | Mock store + local WS simulation in `server.ts` |
| **Full local stack** | `docker compose up` | App + Redis + Postgres (UI may still simulate until wired) |
| **Control plane** | Postgres + Redis + `backend` binary | Real CRUD, JWT auth, audit |
| **API-backed UI** | `NEXT_PUBLIC_API_URL=http://localhost:8080` | Frontend talks to Go; mock hydrate disabled |

## Deferred until backend exists

These UI modules are **mock / localStorage only** and must not grow until APIs land:

- AI analytics panels (`components/ai/*`)
- CI/CD / deployment mock stores
- Collaboration / team workspaces (local)
- Security 2FA / session mock panels
- Integration webhooks stored only in localStorage

## JSON contract

API responses use **camelCase** for field names (`projectId`, `virtualUsers`, `avgResponseTime`) for frontend compatibility.

Auth: `Authorization: Bearer <jwt>`  
Roles: `PLATFORM_ADMIN`, `PERFORMANCE_LEAD`, `PERFORMANCE_ENGINEER`, `DEVELOPER`, `QA`, `RELEASE_MANAGER`, `READ_ONLY`, `SERVICE_ACCOUNT`

## Phase roadmap (summary)

See session plan / `Implementation/32-Full-Project-Implementation-Backlog.md`.

1. Foundation (persist + auth) — **in progress**  
2. Real execution  
3. LoadRunner parity  
4. UX routes  
5. K8s depth  
6. Observability + CI gates  
7. Real AI  
8. Integrations / multi-region  
