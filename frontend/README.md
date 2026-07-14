# SpeedRunner Enterprise — Performance Dashboard

A real-time load testing dashboard built with Next.js 16, React 19, Zustand, and WebSocket. Monitor active load tests, response trends, and test infrastructure from a single-page client-rendered app.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:8787](http://localhost:8787) in your browser.

## Architecture

```
┌─────────────────────────────────┐
│  Custom Server (server.ts)      │
│  ┌───────────┐  ┌────────────┐  │
│  │ Next.js   │  │ WebSocket  │  │
│  │ (SSR)     │  │ (ws)       │  │
│  └───────────┘  └─────┬──────┘  │
│                       │         │
│  Server-side state    │         │
│  + tick() every 1s ───┘         │
└───────────────┬─────────────────┘
                │ ws://localhost:8787/ws
                ▼
┌─────────────────────────────────┐
│  Client (React + Zustand)       │
│  useWebSocket() → live updates  │
└─────────────────────────────────┘
```

**Data flow:**
- Server holds the source of truth (tests, runs, live metrics, trend data)
- Server pushes state snapshots and tick updates to all connected clients via WebSocket
- Client sends actions (create, start, stop, delete) to the server
- Falls back to client-side simulation if WebSocket is unavailable

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start custom server (Next.js + WebSocket) on port 8787 |
| `npm run dev:client` | Start Next.js only (client-side simulation fallback) |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm test` | Run unit tests (watch mode) |
| `npm run test:run` | Run unit tests (single run) |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript 5
- **UI:** React 19, Tailwind CSS v4, shadcn/ui (New York style)
- **State:** Zustand 5
- **Charts:** Recharts 3
- **Forms:** React Hook Form + Zod v4
- **Real-time:** WebSocket (ws library)
- **Testing:** Vitest, React Testing Library, Playwright

## Project Structure

```
frontend/
├── app/
│   ├── page.tsx              # Dashboard page (client component)
│   ├── layout.tsx            # Root layout with Inter font
│   └── globals.css           # Tailwind + CSS variables
├── components/
│   ├── dashboard/            # Header, SummaryCards, InfrastructureHealth
│   ├── charts/               # TrendCharts (Response Time + Throughput)
│   ├── tests/                # ActiveTestsTable, RecentRunsTable, CreateTestModal, TestActions
│   └── ui/                   # shadcn/ui components
├── hooks/
│   ├── useSimulation.ts      # Client-side fallback simulation
│   └── useWebSocket.ts       # WebSocket connection + state sync
├── lib/
│   ├── simulation.ts         # Metric generation engine
│   ├── validation.ts         # Zod schemas
│   └── ws-types.ts           # WebSocket message types
├── store/
│   └── test-store.ts         # Zustand store (state + actions + selectors)
├── data/
│   └── mock-data.ts          # Seed data generator
├── types/
│   └── index.ts              # TypeScript interfaces
├── server.ts                 # Custom Next.js + WebSocket server
├── e2e/
│   └── dashboard.spec.ts     # Playwright E2E tests
└── __tests__/                # Unit tests (store, hooks, components, lib)
```

## Features

- **Real-time metrics:** Live throughput, response time, and error rate updates via WebSocket
- **Test lifecycle:** Create, start, stop, and delete load tests
- **Trend charts:** Response time and throughput over time (Recharts)
- **Multi-tab support:** All browser tabs share the same server-side state
- **Graceful fallback:** Works without WebSocket using client-side simulation
- **Auto-reconnect:** WebSocket reconnects with exponential backoff on disconnect
