# SpeedRunner Enterprise — Full Implementation Guide

> **Historical MVP note (2026-07):** This document describes the original **client-only mock** plan from `Agents.md`. The live architecture is a **Go control plane + Next.js portal + Postgres/Redis + Helm**. Prefer **`ARCHITECTURE.md`** and **`PHASES.md`** for current truth. Sections below remain useful for UI/UX MVP requirements.

This document originally turned `Agents.md` into a build-ready plan for a client-side Next.js dashboard in `frontend/` with mock data and a local simulation engine.

## 1. Product outcome

Deliver a responsive, single-page SpeedRunner Enterprise dashboard that lets a user:

- View test, run, response-time, throughput, and infrastructure summaries.
- Create a load test with validated form data.
- Start, stop, and delete tests safely.
- See running-test metrics and charts update every second.
- Review the ten most recent historical runs.

The MVP must be production-buildable, type-safe, lint-clean, and covered by unit and end-to-end tests.

## 2. Technical decisions

| Area | Decision |
| --- | --- |
| Framework | Next.js with TypeScript and App Router |
| Rendering | Client-rendered dashboard; root layout remains a server component |
| Styling | Tailwind CSS plus shadcn/ui components |
| State | Zustand store with selector-based subscriptions |
| Forms | React Hook Form with Zod validation |
| Charts | Recharts `LineChart` components |
| Icons | `lucide-react` |
| Unit tests | Vitest, React Testing Library, and jsdom |
| E2E tests | Playwright |
| Live behavior | Local `setInterval` tick every second while one or more tests run |

## 3. Implementation sequence

### Phase 1 — Project setup

1. Initialize `frontend/` as a Next.js TypeScript App Router project.
2. Configure Tailwind CSS, strict TypeScript, ESLint, and Prettier.
3. Initialize shadcn/ui with New York style, Zinc base color, and CSS variables.
4. Add the UI primitives: `button`, `dialog`, `input`, `select`, `badge`, `table`, `card`, and `label`.
5. Install runtime dependencies:

   ```bash
   npm install zustand recharts react-hook-form zod @hookform/resolvers lucide-react
   ```

6. Install test dependencies and configuration:

   ```bash
   npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event playwright
   ```

7. Configure scripts for development, linting, type checking, unit tests, E2E tests, and production builds.

**Acceptance criteria:** `npm run dev` launches, the starter page renders, and the repository ignores dependencies, build output, coverage, and Playwright artifacts.

### Phase 2 — Domain, data, and simulation

Create these modules first so UI components consume stable interfaces.

| File | Responsibility |
| --- | --- |
| `types/index.ts` | `Test`, `Run`, `LiveMetrics`, `InfrastructureStatus`, `TrendPoint`, status unions, and creation input type |
| `data/mock-data.ts` | Factory functions for isolated seed data; no module-level mutable state |
| `lib/simulation.ts` | Bounded random-walk metric generation and numeric helpers |
| `lib/utils.ts` | `cn`, date/time formatters, duration formatting, and numeric display helpers |
| `store/test-store.ts` | Zustand state, actions, `tick`, and independently exported selectors |
| `hooks/useSimulation.ts` | Lifecycle-safe interval management |

#### Required seed data

- Create 8–10 tests: five running, two or three completed, and one or two idle.
- Use HTTP, TruClient, and JMeter scripts; virtual-user counts range from 50 to 2,000.
- Create at least 20 historical runs over the last seven days.
- Seed Controller and Database as healthy; Load Generator may be healthy or degraded.
- Seed 20 trend points over the previous two hours.

#### Simulation rules

For every running test, `tick()` updates its `LiveMetrics` once per second:

- `duration`: increases by one second.
- `throughput`: centered near `virtualUsers * 0.8`, with a ±10% bounded random walk, always positive.
- `avgResponseTime`: centered near `200 + virtualUsers * 2`, with a ±15% bounded random walk, never below 50 ms.
- `errorRate`: centered near 1.5%, with a ±1% bounded random walk, clamped from 0 to 100.
- Append a trend point when there is at least one running test, retaining only the latest 30 points.

Use a cleanup-safe `useEffect` interval. It must start only when the running-test count is positive and clear immediately when no tests remain running or the page unmounts.

#### Store behavior

`createTest(data)` creates an idle test with a generated ID and current creation timestamp.

`startTest(testId)` switches the test to `running`, records the start time, and initializes live metrics. It must not start an already-running test.

`stopTest(testId)` switches the test to `stopped`, finalizes a run from its final live-metric snapshot, records the last-run timestamp, and removes the test’s live metrics.

`deleteTest(testId)` removes the test and related active live metrics. The UI must require confirmation before it calls this action.

Export selectors rather than reading the whole store in components:

- `selectTotalTests`
- `selectRunningTests`
- `selectCompletedRuns`
- `selectAvgResponseTime`
- `selectActiveTests`
- `selectRecentRuns`

**Acceptance criteria:** Store actions produce valid state transitions, `tick()` changes only running-test metrics, all generated values remain in bounds, and selectors return predictable values for empty data.

### Phase 3 — Dashboard UI

Implement the following component hierarchy:

```text
app/page.tsx
└── DashboardPage
    ├── Header
    ├── SummaryCards
    ├── TrendCharts
    ├── ActiveTestsTable
    │   └── CreateTestModal
    ├── RecentRunsTable
    └── InfrastructureHealth
```

#### `components/dashboard/Header.tsx`

Render the SpeedRunner Enterprise brand and workspace name. Keep the header concise; this MVP has no navigation.

#### `components/dashboard/SummaryCards.tsx`

Render four responsive cards using selector-derived values:

1. Total Tests
2. Running Tests
3. Completed Runs
4. Average Response Time

Use Lucide icons and subtle semantic accents—blue for running state and green for completed state.

#### `components/charts/TrendCharts.tsx`

Render response time and throughput `LineChart`s side by side on desktop and stacked on narrow screens. Both charts need a concise time axis, tooltip, muted grid, and monotone line. Set `isAnimationActive={false}` while live data is updating to avoid rendering jank.

#### `components/tests/ActiveTestsTable.tsx` and `TestActions.tsx`

Show active tests with these columns:

| Name | Script Type | Target URL | Virtual Users | Status | Last Run | Actions |
| --- | --- | --- | ---: | --- | --- | --- |

Use color-coded status badges. Running badges must pulse. Start is disabled for running tests; Stop is disabled for all non-running tests. Delete opens a confirmation before removal. Provide a graceful empty state.

#### `components/tests/CreateTestModal.tsx`

Place a fixed, bottom-right “New Test” button that opens a shadcn Dialog. The form must include:

- Test Name (required)
- Description
- Script Type (required select)
- Target URL (required valid URL)
- Virtual Users (required integer within a sensible positive range)

Show inline Zod validation errors. After a successful submission, call `createTest`, reset the form, and close the dialog.

#### `components/tests/RecentRunsTable.tsx`

Display the newest ten runs with test name, status, duration, throughput, average response time, and error rate. Sort descending by completion time. Provide a status badge or colored indicator and an empty state.

#### `components/dashboard/InfrastructureHealth.tsx`

Render Controller, Load Generator, and Database status cards. Every card includes an accessible healthy/degraded/down indicator and last-checked timestamp.

#### `app/page.tsx`

Mark this page with `'use client'`. Initialize the simulation hook, compose the page sections, and provide initial skeletons only if hydration/initial loading is visibly asynchronous. Avoid broad Zustand subscriptions; each component should select the smallest state slice it needs.

**Acceptance criteria:** All specified controls work without a page refresh; starting a test visibly updates its status and charts; stopping it creates a recent run; deleting it removes it after confirmation; and mobile tables remain usable through horizontal scrolling.

### Phase 4 — Visual polish and accessibility

Use the palette below consistently:

| Purpose | Color |
| --- | --- |
| Primary blue | `#209dd7` |
| Warning amber | `#ecad0a` |
| Chart purple | `#753991` |
| Ink/navy | `#032147` |
| Page background | `#f7f8fa` |

- Use Inter from `next/font` in `app/layout.tsx`.
- Give cards consistent radius, light borders/shadows, and restrained hover lift.
- Use visible keyboard focus states and icon button labels/tooltips.
- Add table-row hover states and reduced-motion-friendly transitions.
- Stack summary cards and charts on mobile, and wrap tables in horizontal scroll containers.
- Ensure status never relies on color alone; include text and/or an icon.

**Acceptance criteria:** No clipped content at mobile widths, all interactive controls are keyboard reachable, and live updates do not cause layout shifts or chart animation stutter.

### Phase 5 — Verification and tests

Mirror source organization under `__tests__/`, then add `e2e/dashboard.spec.ts`.

| Area | Required coverage |
| --- | --- |
| Simulation | Random-walk behavior, duration increments, and metric clamps |
| Store | Create/start/stop/delete, run finalization, selectors, trend retention |
| Validation | Valid form and each invalid required/URL/virtual-user case |
| Components | Summary values, table rows/actions, dialog behavior, error states |
| Hook | Starts interval with running tests and cleans it up correctly |
| E2E | Dashboard load, create, start, stop, delete, chart visibility/update, validation feedback |

Run the final validation from `frontend/`:

```bash
npx tsc --noEmit
npx next lint
npx vitest run --coverage
npx playwright test
npx next build
```

Target at least 80% unit-test coverage. If a command fails, fix the underlying implementation rather than weakening the check.

## 4. Final file layout

```text
frontend/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── charts/TrendCharts.tsx
│   ├── dashboard/Header.tsx
│   ├── dashboard/InfrastructureHealth.tsx
│   ├── dashboard/SummaryCards.tsx
│   ├── tests/ActiveTestsTable.tsx
│   ├── tests/CreateTestModal.tsx
│   ├── tests/RecentRunsTable.tsx
│   ├── tests/TestActions.tsx
│   └── ui/
├── data/mock-data.ts
├── e2e/dashboard.spec.ts
├── hooks/useSimulation.ts
├── lib/simulation.ts
├── lib/utils.ts
├── store/test-store.ts
├── types/index.ts
├── __tests__/
├── playwright.config.ts
├── vitest.config.ts
└── README.md
```

## 5. Definition of done

The SpeedRunner Enterprise MVP is complete when all items below are true:

- The dashboard matches the component and behavior requirements in this document.
- Seeded data renders immediately and at least five tests simulate on initial load.
- All test lifecycle actions work and preserve consistent state.
- Metrics and trend charts refresh once per second only while tests run.
- The interface is responsive, accessible, and visually consistent with the defined palette.
- Unit coverage is at least 80%; all E2E scenarios pass.
- Type checking, linting, unit tests, E2E tests, and a production build succeed.
- `frontend/README.md` explains setup, scripts, architecture, and simulation limitations.
