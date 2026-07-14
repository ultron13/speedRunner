import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";

import { createMockData } from "./data/mock-data";
import {
  clampTrendData,
  createInitialMetrics,
  generateNextMetrics,
} from "./lib/simulation";
import type { ClientMessage, ServerMessage, TickUpdate } from "./lib/ws-types";
import type {
  CreateTestInput,
  InfrastructureStatus,
  LiveMetrics,
  Run,
  Test,
  TrendPoint,
} from "./types";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT ?? "8787", 10);
const wsPort = parseInt(process.env.WS_PORT ?? "8788", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ── Server-side state ──────────────────────────────────────────────
let tests: Test[] = [];
let runs: Run[] = [];
let liveMetrics = new Map<string, LiveMetrics>();
let trendData: TrendPoint[] = [];
let infrastructure: InfrastructureStatus[] = [];
let tickInterval: ReturnType<typeof setInterval> | null = null;

const newId = (prefix: string) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

function hydrate() {
  const seed = createMockData();
  tests = seed.tests;
  runs = seed.runs;
  trendData = seed.trendData;
  infrastructure = seed.infrastructure;
  liveMetrics = new Map();
  seed.tests
    .filter((t) => t.status === "running")
    .forEach((t) => {
      liveMetrics.set(t.id, createInitialMetrics(t.id, t.virtualUsers));
    });
}

function getSnapshot() {
  const liveMetricsObj: Record<string, LiveMetrics> = {};
  liveMetrics.forEach((v, k) => {
    liveMetricsObj[k] = v;
  });
  return { tests, runs, liveMetrics: liveMetricsObj, trendData, infrastructure };
}

function tick() {
  const runningTests = tests.filter((t) => t.status === "running");
  if (runningTests.length === 0) return;

  const timestamp = Date.now();
  const nextMetrics = new Map(liveMetrics);
  const activeMetrics: LiveMetrics[] = [];

  runningTests.forEach((test) => {
    const current =
      nextMetrics.get(test.id) ??
      createInitialMetrics(test.id, test.virtualUsers, timestamp);
    const next = generateNextMetrics(current, test.virtualUsers, timestamp);
    nextMetrics.set(test.id, next);
    activeMetrics.push(next);
  });

  const throughput = activeMetrics.reduce((sum, m) => sum + m.throughput, 0);
  const responseTime = Math.round(
    activeMetrics.reduce((sum, m) => sum + m.avgResponseTime, 0) /
      activeMetrics.length,
  );

  const newPoint: TrendPoint = {
    timestamp: new Date(timestamp).toISOString(),
    responseTime,
    throughput,
  };
  trendData = clampTrendData([...trendData, newPoint]);

  liveMetrics = nextMetrics;

  const liveMetricsObj: Record<string, LiveMetrics> = {};
  liveMetrics.forEach((v, k) => {
    liveMetricsObj[k] = v;
  });

  const update: TickUpdate = { liveMetrics: liveMetricsObj, trendData };
  broadcast({ type: "tick", payload: update });
}

function startTickIfNeeded() {
  const hasRunning = tests.some((t) => t.status === "running");
  if (hasRunning && !tickInterval) {
    tickInterval = setInterval(tick, 1_000);
  } else if (!hasRunning && tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

// ── Action handlers ────────────────────────────────────────────────
function handleCreateTest(data: CreateTestInput) {
  const now = new Date().toISOString();
  tests = [
    ...tests,
    {
      id: newId("test"),
      name: data.name.trim(),
      description: data.description?.trim() ?? "",
      scriptType: data.scriptType,
      targetUrl: data.targetUrl.trim(),
      virtualUsers: data.virtualUsers,
      status: "idle" as const,
      createdAt: now,
      lastRunAt: null,
    },
  ];
  broadcast({ type: "snapshot", payload: getSnapshot() });
}

function handleStartTest(testId: string) {
  const test = tests.find((t) => t.id === testId);
  if (!test || test.status === "running") return;

  const timestamp = Date.now();
  liveMetrics.set(testId, createInitialMetrics(testId, test.virtualUsers, timestamp));
  tests = tests.map((t) =>
    t.id === testId ? { ...t, status: "running" as const } : t,
  );

  startTickIfNeeded();
  broadcast({ type: "snapshot", payload: getSnapshot() });
}

function handleStopTest(testId: string) {
  const test = tests.find((t) => t.id === testId);
  if (!test || test.status !== "running") return;

  const metrics =
    liveMetrics.get(testId) ?? createInitialMetrics(testId, test.virtualUsers);
  const completedAt = new Date().toISOString();
  const startedAt = new Date(
    metrics.timestamp - metrics.duration * 1_000,
  ).toISOString();

  liveMetrics.delete(testId);
  tests = tests.map((t) =>
    t.id === testId ? { ...t, status: "stopped" as const, lastRunAt: completedAt } : t,
  );
  runs = [
    {
      id: newId("run"),
      testId,
      testName: test.name,
      status: "stopped" as const,
      startedAt,
      completedAt,
      duration: metrics.duration,
      throughput: metrics.throughput,
      avgResponseTime: metrics.avgResponseTime,
      errorRate: metrics.errorRate,
    },
    ...runs,
  ];

  startTickIfNeeded();
  broadcast({ type: "snapshot", payload: getSnapshot() });
}

function handleDeleteTest(testId: string) {
  liveMetrics.delete(testId);
  tests = tests.filter((t) => t.id !== testId);
  startTickIfNeeded();
  broadcast({ type: "snapshot", payload: getSnapshot() });
}

// ── WebSocket server (separate port to avoid HMR conflict) ─────────
const clients = new Set<WebSocket>();

function broadcast(message: ServerMessage) {
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

const wss = new WebSocketServer({ port: wsPort, host: "0.0.0.0" });

wss.on("connection", (ws) => {
  clients.add(ws);
  console.log(`[ws] Client connected (${clients.size} total)`);

  ws.send(
    JSON.stringify({
      type: "connected",
      payload: { clientId: newId("client") },
    } satisfies ServerMessage),
  );

  ws.send(
    JSON.stringify({
      type: "snapshot",
      payload: getSnapshot(),
    } satisfies ServerMessage),
  );

  ws.on("message", (raw) => {
    try {
      const msg: ClientMessage = JSON.parse(raw.toString());
      switch (msg.type) {
        case "createTest":
          handleCreateTest(msg.payload);
          break;
        case "startTest":
          handleStartTest(msg.payload.testId);
          break;
        case "stopTest":
          handleStopTest(msg.payload.testId);
          break;
        case "deleteTest":
          handleDeleteTest(msg.payload.testId);
          break;
      }
    } catch (err) {
      console.error("[ws] Invalid message:", err);
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log(`[ws] Client disconnected (${clients.size} remaining)`);
  });
});

console.log(`[ws] WebSocket server on ws://0.0.0.0:${wsPort}`);

// ── Next.js server ─────────────────────────────────────────────────
hydrate();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error handling request:", err);
      res.writeHead(500);
      res.end("Internal Server Error");
    }
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
