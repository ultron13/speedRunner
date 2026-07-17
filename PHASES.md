# SpeedRunner Implementation Phases

Mapped from `Implementation/32-Full-Project-Implementation-Backlog.md` plus production waves **7.1–14.20** and enterprise roadmap **21–41** (**391** catalog items).

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
| **14.1–14.20** | Enterprise extensions (templates, freeze, DLQ, …) | **Done** |
| **21–41** | Full enterprise depth (portfolio → self-health) | **Done** |

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

## Phase 14 (14.1–14.20) API map

| API | Focus |
| --- | --- |
| `GET /api/workspace/templates` | Starter workspace packs |
| `POST /api/security/secret-rotation` | Rotation due checks |
| `/api/runs/annotations` | Run notes / bookmarks |
| `POST /api/platform/freeze` | Change freeze windows |
| `POST /api/impact/dependencies` | Downstream impact BFS |
| `POST /api/scorecard` | Engineering scorecard |
| `POST /api/experiments/bucket` | A/B experiment bucket |
| `POST /api/audit/export` | Audit CSV export |
| `/api/webhooks/dead-letters` | Webhook DLQ |
| `POST /api/suites/order` | Suite pack ordering |
| `POST /api/env/promotion` | Env promotion gate |
| `POST /api/security/secret-scan` | Pre-run secret scan |
| `POST /api/security/ip-allowlist` | IP allowlist check |

## Phases 21–41 (enterprise depth)

| ID | Capability | API |
| --- | --- | --- |
| 21 | Portfolio dashboard | `POST /api/portfolio/summary` |
| 22 | Asset versioning | `GET/POST /api/assets/versions` |
| 23 | Script branch merge check | `POST /api/scripts/branch/merge-check` |
| 24 | Parameterization wizard | `POST /api/scripts/parameters/suggest` |
| 25 | Correlation studio | `POST /api/scripts/correlation/detect` |
| 26–28 | WAN + think-time profiles | `GET /api/network/profiles` |
| 29 | LG auto-heal | `POST /api/generators/auto-heal` |
| 30 | Distributed shard aggregation | `POST /api/results/aggregate-shards` |
| 31 | Multi-run comparison matrix | `POST /api/runs/comparison-matrix` |
| 32 | Executive board pack | `POST /api/reports/executive-pack` |
| 33–34 | SLA incident + escalation | `POST /api/incidents/from-sla` |
| 35 | Quota soft/hard enforce | `POST /api/quotas/enforce` |
| 36 | Blue-green env switch | `POST /api/env/blue-green` |
| 37 | Data residency hard gate | `POST /api/residency/gate` |
| 38 | Testing calendar conflicts | `POST /api/calendar/conflicts` |
| 39 | Flaky run detector | `POST /api/runs/flaky` |
| 40 | Regression baseline z-score | `POST /api/runs/regression-baseline` |
| 41 | Platform self-health | `GET/POST /api/platform/self-health` |

UI: `/admin/enterprise`

## Phase catalogs

- `GET /api/platform/phases?wave=7\|…\|14\|21-41\|all`
- `/all` → **391** items

### Domain modules

- `backend/internal/platform/phase7.go` … `phase13.go`
- `backend/internal/server/handlers_phase7.go` … `handlers_phase11_13.go`
- `frontend/lib/api-client.ts` — client methods for waves 7–13

## Real adapters (OIDC / SCIM / Jira)

| Adapter | Endpoints | Config |
| --- | --- | --- |
| **OIDC** | `GET /api/auth/oidc/status`, `/login`, `/callback` | `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URL` |
| **SCIM 2.0** | `/api/scim/v2/Users`, `ServiceProviderConfig` | `SCIM_TOKEN` or admin JWT |
| **Jira** | `/api/integrations/jira/*` | `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` |

### Admin UI

- `/admin` — hub
- `/admin/sso` — OIDC status + demo login
- `/admin/scim` — directory provision / deactivate
- `/admin/connectors` — partner hub + Jira issue/search/defect
- `/admin/tenants` — multi-tenant workspaces
- `/admin/marketplace` — install scripts/templates
- `/admin/finops` — cost + carbon estimates

## Local minikube

```bash
make k8s-deploy
kubectl -n marathonrunner-system port-forward svc/speedrunner 8787:8787
kubectl -n marathonrunner-system port-forward svc/speedrunner-backend 8080:8080
```

## Tests

- Frontend: `npm run typecheck`, `npm run test:run`
- Backend: `go test ./...`
