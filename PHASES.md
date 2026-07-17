# SpeedRunner Implementation Phases

Mapped from `Implementation/32-Full-Project-Implementation-Backlog.md` plus production waves **7.1–13.50** (350 catalog items).

## Completed waves

| Range | Theme | Status |
| --- | --- | --- |
| 1–2 | Foundation + LoadRunner parity | Done |
| 3 | Multi-page UX | Done |
| 4.1–4.12 | Multi-engine → ChatOps + policy | Done |
| 5.1–5.13 | AI-assisted engineering APIs | Done |
| 6.1–6.13 | Enterprise enhancements APIs | Done |
| **7.1–7.50** | Production platform hardening | **Done** |
| **8.1–8.50** | Advanced enterprise operations | **Done** |
| **9.1–9.50** | Resilience, multi-region DR, observability | **Done** |
| **10.1–10.50** | OpenText EPE CE 25.3 video parity | **Done** |
| **11.1–11.50** | Multi-tenant SaaS, marketplace, licensing | **Done** |
| **12.1–12.50** | CI quality gates, digital twin, chaos, journeys | **Done** |
| **13.1–13.50** | Edge/mobile, FinOps carbon, partner connectors | **Done** |

## Phase 11 API map

| API | Focus |
| --- | --- |
| `/api/tenants` | Tenant registry & isolation |
| `POST /api/license/validate` | VU / concurrent license gates |
| `/api/marketplace` | Script/plugin/template marketplace |
| `GET /api/api-tiers` | API product rate tiers & scopes |
| `/api/sso/config` | OIDC/SAML SSO validation |
| `/api/scim/users` | SCIM user provisioning |
| `/api/usage` | Usage metering (VU-hours, API calls) |

## Phase 12 API map

| API | Focus |
| --- | --- |
| `POST /api/ci/quality-gate` | Release quality gates |
| `POST /api/capacity/digital-twin` | What-if capacity simulation |
| `/api/chaos/scenarios` | Advanced chaos catalog + runs |
| `POST /api/journeys/validate` | Browser journey validation |
| `POST /api/ci/perf-budget` | PR/CI performance budgets |

## Phase 13 API map

| API | Focus |
| --- | --- |
| `GET /api/edge/locations` | Edge POPs + mobile network profiles |
| `POST /api/edge/mobile-network` | Adjust p95 for mobile networks |
| `POST /api/finops/estimate` | Cost + carbon (kg CO₂e) estimate |
| `/api/connectors` | Jira, Slack, GitHub, Datadog, … hub |
| `/api/webhooks/deliveries` | Webhook delivery ledger & retry |

## Phase catalogs

- `GET /api/platform/phases?wave=7\|8\|…\|13\|all`
- `GET /api/platform/phases/{7..13}` and `/all` → **350** items

### Domain modules

- `backend/internal/platform/phase7.go` … `phase13.go`
- `backend/internal/server/handlers_phase7.go` … `handlers_phase11_13.go`
- `frontend/lib/api-client.ts` — client methods for waves 7–13

## Local minikube

```bash
make k8s-deploy
kubectl -n marathonrunner-system port-forward svc/speedrunner 8787:8787
kubectl -n marathonrunner-system port-forward svc/speedrunner-backend 8080:8080
```

## Tests

- Frontend: `npm run typecheck`, `npm run test:run`
- Backend: `go test ./...`
