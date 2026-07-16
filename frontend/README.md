# SpeedRunner Enterprise

LoadRunner-class performance testing platform — control plane, multi-engine execution, and enterprise portal.

## Quick start

### UI demo (mock data, no backend)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:8787  
**Login:** `admin@example.com` / `admin123`

### Full control plane

```bash
# Postgres + Redis
docker compose up -d postgres redis

# Go API
cd backend
export DATABASE_URL=postgresql://speedrunner:speedrunner_secret@localhost:5432/speedrunner
export REDIS_URL=redis://localhost:6379
export ENGINE_MODE=simulate   # or auto | http | jmeter | k6
go run ./cmd/server

# Portal (API-backed)
cd frontend
export NEXT_PUBLIC_API_URL=http://localhost:8080
npm run dev
```

**Control-plane login:** `admin@speedrunner.local` / `admin123`

## Product surface

| Area | Path | Capability |
| --- | --- | --- |
| Dashboard | `/` | Live summary, charts, active tests, runs, infrastructure |
| Tests | `/tests` | Catalog, start/stop/delete, bulk actions |
| Runs | `/runs` | Result repository |
| Schedules | `/schedules` | Recurring execution (control plane polls every 30s) |
| SLA | `/sla` | Thresholds evaluated on run stop |
| LG Pools | `/pools` | Capacity reservation by region/engine |
| Reports | `/reports` | Engineering reports from completed runs |
| Analytics | `/analytics` | Trends, AI anomaly/recommend panels |

## Engine modes (`ENGINE_MODE`)

| Mode | Behavior |
| --- | --- |
| `simulate` | In-process metric simulation (default) |
| `http` | Real HTTP load from backend (capped) |
| `jmeter` / `k6` | Kubernetes Jobs |
| `auto` | Choose by test `scriptType` |

## Scripts (frontend)

| Command | Description |
| --- | --- |
| `npm run dev` | Custom server + WebSocket demo on :8787 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:run` | Vitest unit tests |
| `npm run test:e2e` | Playwright |
| `npm run build` | Production Next build |

## Architecture

See root `ARCHITECTURE.md` and `Implementation/` for the MarathonRunner enterprise backlog.

```
Browser → Next.js portal (Zustand)
       → REST NEXT_PUBLIC_API_URL → Go control plane (:8080)
       → Postgres + Redis
       → Engines: simulate | http | JMeter/k6 Jobs on K8s
```
