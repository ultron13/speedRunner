# SpeedRunner Enterprise MVP — Implementation Plan

Based on `Agent.md` spec. All work happens in `frontend/`.

---

## Architecture Overview

**Single-page client-rendered app.** No backend, no API. All state lives in a Zustand store seeded with mock data on first render. A simulation engine (`setInterval` at 1s) updates running test metrics and pushes new data points to trend charts.

**Data flow:**
```
Mock Data Seed → Zustand Store → React Components → UI
                  ↑                    ↓
          Simulation Engine ← Timer tick (1s)
```

**Component hierarchy:**
```
app/page.tsx (layout shell)
└── DashboardPage (client component, owns the store subscription)
    ├── Header
    ├── SummaryCards
    ├── TrendCharts
    ├── ActiveTestsTable
    │   └── CreateTestModal
    ├── RecentRunsTable
    └── InfrastructureHealth
```

---

## Folder Structure

```
frontend/
├── app/
│   ├── layout.tsx          # Root layout: Inter font, Tailwind globals
│   ├── page.tsx            # DashboardPage wrapper (client component)
│   └── globals.css         # Tailwind directives + custom properties
├── components/
│   ├── dashboard/
│   │   ├── Header.tsx
│   │   ├── SummaryCards.tsx
│   │   └── InfrastructureHealth.tsx
│   ├── charts/
│   │   └── TrendCharts.tsx  # Response Time + Throughput charts
│   ├── tests/
│   │   ├── ActiveTestsTable.tsx
│   │   ├── RecentRunsTable.tsx
│   │   ├── CreateTestModal.tsx
│   │   └── TestActions.tsx   # Start/Stop/Delete buttons
│   └── ui/                   # shadcn/ui components (auto-generated)
├── hooks/
│   └── useSimulation.ts      # Timer hook driving metric updates
├── lib/
│   ├── utils.ts              # cn() helper, formatters
│   └── simulation.ts         # Metric generation logic
├── store/
│   └── test-store.ts         # Zustand store
├── types/
│   └── index.ts              # All TypeScript types
├── data/
│   └── mock-data.ts          # Seed data generator
├── __tests__/                # Unit tests (mirror component structure)
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   └── store/
├── e2e/                      # Playwright tests
│   └── dashboard.spec.ts
├── public/
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
├── package.json
├── .gitignore
├── README.md
├── .eslintrc.json
└── .prettierrc
```

---

## Data Model (TypeScript Types)

```typescript
// types/index.ts

export type TestStatus = 'idle' | 'running' | 'completed' | 'stopped' | 'failed';
export type ScriptType = 'HTTP' | 'TruClient' | 'JMeter';

export interface Test {
  id: string;
  name: string;
  description: string;
  scriptType: ScriptType;
  targetUrl: string;
  virtualUsers: number;
  status: TestStatus;
  createdAt: string;
  lastRunAt: string | null;
}

export interface Run {
  id: string;
  testId: string;
  testName: string;
  status: 'completed' | 'stopped' | 'failed';
  startedAt: string;
  completedAt: string;
  duration: number;        // seconds
  throughput: number;      // requests/sec
  avgResponseTime: number; // ms
  errorRate: number;       // percentage
}

export interface LiveMetrics {
  testId: string;
  duration: number;
  throughput: number;
  avgResponseTime: number;
  errorRate: number;
  timestamp: number;
}

export interface InfrastructureStatus {
  component: string;
  status: 'healthy' | 'degraded' | 'down';
  lastChecked: string;
}

export interface TrendPoint {
  timestamp: string;
  responseTime: number;
  throughput: number;
}
```

---

## Zustand Store Design

```typescript
// store/test-store.ts

interface TestStore {
  // State
  tests: Test[];
  runs: Run[];
  liveMetrics: Map<string, LiveMetrics>;
  trendData: TrendPoint[];
  infrastructure: InfrastructureStatus[];

  // Actions
  createTest: (data: CreateTestInput) => void;
  startTest: (testId: string) => void;
  stopTest: (testId: string) => void;
  deleteTest: (testId: string) => void;

  // Simulation (called by useSimulation hook)
  tick: () => void;  // Updates all running test metrics + trend data

  // Computed (via selectors)
  // totalTests, runningTests, completedRuns, avgResponseTime
}
```

**Selectors** (separate exports to avoid re-render cascades):
- `selectTotalTests(state)` → `state.tests.length`
- `selectRunningTests(state)` → `state.tests.filter(t => t.status === 'running').length`
- `selectCompletedRuns(state)` → `state.runs.filter(r => r.status === 'completed').length`
- `selectAvgResponseTime(state)` → average of recent run response times
- `selectActiveTests(state)` → tests with status idle/running
- `selectRecentRuns(state)` → last 10 runs sorted by date

---

## Simulation Engine Design

**File:** `lib/simulation.ts`

Core function: `generateNextMetrics(current: LiveMetrics, virtualUsers: number): LiveMetrics`

- **Duration**: increments by 1 each tick
- **Throughput**: base ~`(virtualUsers * 0.8)` with ±10% bounded random walk (clamp to >0)
- **Avg Response Time**: base ~`(200 + virtualUsers * 2)` with ±15% bounded random walk (clamp to >50ms)
- **Error Rate**: base ~`1.5%` with ±1% bounded random walk (clamp to 0-100%)

**Random walk formula:** `next = current + (Math.random() - 0.5) * range * 2`, clamped to bounds.

**Hook:** `useSimulation()` — runs `setInterval(tick, 1000)` in a `useEffect`. Cleans up on unmount. Only active when there are running tests.

**Trend data:** On each tick, if any test is running, append a new `TrendPoint` to the store. Keep last ~30 points. Charts read from this array.

---

## Mock Data Strategy

**File:** `data/mock-data.ts`

Generate on store initialization:

**8-10 tests:**
- 5 with status `running` (start simulating immediately)
- 2-3 with status `completed`
- 1-2 with status `idle`

Realistic names: "Login Flow Load Test", "API Health Check - Prod", "Checkout Performance", "Search API Stress Test", etc.
Realistic URLs: `https://api.example.com/v1/login`, `https://shop.example.com/checkout`, etc.
Script types distributed across HTTP, TruClient, JMeter.
Virtual users: range 50-2000.

**20+ historical runs:**
- Associated with the completed/idle tests
- Spread across last 7 days
- Realistic durations (30s - 30min), throughput (10-500 req/s), response times (80-800ms), error rates (0-5%)

**Infrastructure health:**
- Controller: healthy
- Load Generator: healthy (or degraded)
- Database: healthy

**Trend data:**
- 20 historical points spread over last 2 hours
- Values consistent with completed runs

---

## Component Breakdown

### Header
- App logo/name ("SpeedRunner Enterprise")
- Workspace name
- Minimal — no navigation needed (single page)

### SummaryCards
- 4 cards in a grid: Total Tests, Running Tests, Completed Runs, Avg Response Time
- Each card: icon (lucide), label, value
- Values derived from store selectors
- Subtle color coding (running = blue accent, completed = green)

### TrendCharts
- Two Recharts `LineChart` components side by side (or stacked on mobile)
- Response Time chart (ms, blue line)
- Throughput chart (req/s, purple line)
- X-axis: time (last ~30 points)
- Smooth curves (`type="monotone"`), subtle grid, tooltip on hover
- Charts update in real-time while tests run

### ActiveTestsTable
- Columns: Name, Script Type, Target URL, Virtual Users, Status, Last Run, Actions
- Status shown as colored badge (idle=gray, running=blue pulse, completed=green, stopped=yellow, failed=red)
- Actions column: Start (play icon), Stop (square icon), Delete (trash icon)
- Start disabled when running; Stop disabled when not running
- Table uses basic HTML table with Tailwind styling (no TanStack Table needed for this simplicity)

### CreateTestModal
- Triggered by floating "New Test" button (bottom-right, fixed position)
- shadcn Dialog component
- Form: Test Name, Description, Script Type (select), Target URL, Virtual Users (number)
- React Hook Form + Zod validation
- On submit: calls `createTest()` → closes modal → test appears in table

### RecentRunsTable
- Columns: Test Name, Status, Duration, Throughput, Avg Response Time, Error Rate
- Shows last 10 runs, sorted newest first
- Status as colored dot/badge

### InfrastructureHealth
- 3 cards: Controller, Load Generator, Database
- Each shows: name, status (green/yellow/red indicator), last checked time
- Simulated — values don't actually change (occasionally toggle to degraded for realism)

---

## Implementation Checklist (by Phase)

### Phase 2: Scaffolding
- [ ] Initialize Next.js project in `frontend/` with TypeScript + App Router
- [ ] Install and configure Tailwind CSS
- [ ] Install and configure shadcn/ui (initialize, add Dialog, Button, Input, Select, Badge, Table, Card components)
- [ ] Install Zustand, Recharts, React Hook Form, Zod, lucide-react
- [ ] Install Vitest + React Testing Library + jsdom
- [ ] Install Playwright
- [ ] Configure ESLint + Prettier
- [ ] Set up `tsconfig.json` with strict mode
- [ ] Verify `npm run dev` starts successfully
- [ ] Set up Inter font in layout.tsx

### Phase 3: Core Features
- [ ] Define TypeScript types (`types/index.ts`)
- [ ] Create mock data generator (`data/mock-data.ts`)
- [ ] Build Zustand store (`store/test-store.ts`) with all actions + selectors
- [ ] Implement simulation engine (`lib/simulation.ts`)
- [ ] Implement `useSimulation` hook (`hooks/useSimulation.ts`)
- [ ] Build Header component
- [ ] Build SummaryCards component
- [ ] Build TrendCharts component (Response Time + Throughput)
- [ ] Build ActiveTestsTable with Start/Stop/Delete actions
- [ ] Build CreateTestModal with form validation
- [ ] Build RecentRunsTable
- [ ] Build InfrastructureHealth cards
- [ ] Compose all in DashboardPage (`app/page.tsx`)
- [ ] Wire up simulation — charts update while tests run
- [ ] Test full lifecycle: create → start → observe metrics → stop → delete

### Phase 4: UI Polish
- [ ] Refine spacing and typography (generous whitespace, Inter hierarchy)
- [ ] Add hover states on table rows and buttons
- [ ] Add subtle transitions (color changes, card hover lift)
- [ ] Status badge animations (running = pulse effect)
- [ ] Skeleton loading states for initial render
- [ ] Responsive layout (cards stack on mobile, charts stack, tables scroll horizontally)
- [ ] Floating "New Test" button styling (fixed bottom-right, rounded, shadow)
- [ ] Fine-tune colors to match spec (#209dd7, #ecad0a, #753991, #032147, #f7f8fa)
- [ ] Card shadows, border radius, background consistency
- [ ] Empty state handling (no tests, no runs)

### Phase 5: Testing
- [ ] Unit tests for simulation engine (metric generation, bounds checking)
- [ ] Unit tests for Zustand store (CRUD actions, selectors, state transitions)
- [ ] Unit tests for validation schemas (Zod)
- [ ] Unit tests for key components (SummaryCards renders values, table renders rows, modal opens/closes)
- [ ] Unit tests for useSimulation hook
- [ ] Achieve 80%+ coverage
- [ ] Playwright: Dashboard loads with mock data
- [ ] Playwright: Create test via modal
- [ ] Playwright: Start test, observe status change
- [ ] Playwright: Stop running test
- [ ] Playwright: Delete test
- [ ] Playwright: Charts render and update
- [ ] Playwright: Validation errors shown for invalid form input

### Phase 6: Final Verification
- [ ] Zero TypeScript errors (`npx tsc --noEmit`)
- [ ] Zero ESLint errors (`npx next lint`)
- [ ] All unit tests pass (`npx vitest run`)
- [ ] All Playwright tests pass (`npx playwright test`)
- [ ] Production build succeeds (`npx next build`)
- [ ] Dev server starts and loads dashboard
- [ ] Create README.md
- [ ] Verify .gitignore covers node_modules, .next, test artifacts

---

## Critical Implementation Notes

1. **Simulation timing**: Use `setInterval` inside a `useEffect` with proper cleanup. Only start the interval when there are running tests; clear it when all tests stop. This avoids unnecessary timer ticks.

2. **Store subscriptions**: Use Zustand selectors (`useStore(selectRunningTests)`) instead of subscribing to the whole store — prevents re-render storms when metrics update every second.

3. **Recharts performance**: With 30 data points updating every second, use `isAnimationActive={false}` on live-updating charts to avoid animation jank. Keep animation on historical-only views.

4. **Mock data seed timing**: Generate seed data inside the Zustand store's `create()` (or via a `hydrate` action called once in the dashboard page's `useEffect`). Don't put it in module scope — Next.js may SSR the import.

5. **Client components**: The entire dashboard is client-side rendered. Mark `app/page.tsx` with `'use client'` at the top, or use a client component wrapper. The layout can remain a server component.

6. **Modal form reset**: After `createTest()` succeeds, call `form.reset()` before closing the modal. shadcn Dialog handles the visual close.

7. **Delete confirmation**: Add a simple `window.confirm()` or a shadcn AlertDialog for delete — don't skip this, accidental deletes are bad UX even in an MVP.

8. **Run generation**: When `startTest()` is called, immediately create a Run entry with status in-progress (or just `completed` when stopped). The Run's final metrics come from the last `LiveMetrics` snapshot for that test.

9. **Trend data seeding**: Pre-seed 20 historical trend points so charts aren't empty on load. New points append while tests run.

10. **shadcn/ui init**: Run `npx shadcn@latest init` with New York style, Zinc base color, CSS variables enabled. Then add needed components: `button`, `dialog`, `input`, `select`, `badge`, `table`, `card`, `label`.

