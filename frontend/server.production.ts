import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";

import {
  connectRedis,
  disconnectRedis,
  isRedisConnected,
} from "./lib/redis";
import {
  getSnapshot,
  getLiveMetrics,
  getTests,
  updateTests,
  updateRuns,
  updateLiveMetrics,
  updateTrendData,
  hydrate,
} from "./lib/state";
import {
  clampTrendData,
  createInitialMetrics,
  generateNextMetrics,
} from "./lib/simulation";
import type { ClientMessage, ServerMessage, TickUpdate } from "./lib/ws-types";
import type {
  LiveMetrics,
} from "./types";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT ?? "8787", 10);
const wsPort = parseInt(process.env.WS_PORT ?? "8788", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const newId = (prefix: string) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

let tickInterval: ReturnType<typeof setInterval> | null = null;

// ── Tick logic ───────────────────────────────────────────────────

async function tick() {
  const tests = await getTests();
  const runningTests = tests.filter((t) => t.status === "running");
  if (runningTests.length === 0) return;

  const timestamp = Date.now();
  const nextMetrics = await updateLiveMetrics((current) => {
    const next = new Map(current);
    const activeMetrics: LiveMetrics[] = [];

    for (const test of runningTests) {
      const metric =
        next.get(test.id) ??
        createInitialMetrics(test.id, test.virtualUsers, timestamp);
      const updated = generateNextMetrics(metric, test.virtualUsers, timestamp);
      next.set(test.id, updated);
      activeMetrics.push(updated);
    }

    return next;
  });

  const activeMetrics = runningTests
    .map((t) => nextMetrics.get(t.id))
    .filter(Boolean) as LiveMetrics[];

  if (activeMetrics.length === 0) return;

  const throughput = activeMetrics.reduce((sum, m) => sum + m.throughput, 0);
  const responseTime = Math.round(
    activeMetrics.reduce((sum, m) => sum + m.avgResponseTime, 0) /
      activeMetrics.length,
  );

  const newPoint = {
    timestamp: new Date(timestamp).toISOString(),
    responseTime,
    throughput,
  };

  await updateTrendData((data) => clampTrendData([...data, newPoint]));

  const liveMetricsObj: Record<string, LiveMetrics> = {};
  nextMetrics.forEach((v, k) => {
    liveMetricsObj[k] = v;
  });

  const trendData = await import("./lib/state").then((m) => m.getTrendData());
  const update: TickUpdate = { liveMetrics: liveMetricsObj, trendData };
  broadcast({ type: "tick", payload: update });
}

async function startTickIfNeeded() {
  const tests = await getTests();
  const hasRunning = tests.some((t) => t.status === "running");
  if (hasRunning && !tickInterval) {
    tickInterval = setInterval(tick, 1_000);
  } else if (!hasRunning && tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

// ── Action handlers ──────────────────────────────────────────────

async function handleCreateTest(data: { name: string; description?: string; scriptType: string; targetUrl: string; virtualUsers: number }) {
  const now = new Date().toISOString();
  const newTest = {
    id: newId("test"),
    name: data.name.trim(),
    description: data.description?.trim() ?? "",
    scriptType: data.scriptType as "HTTP" | "TruClient" | "JMeter",
    targetUrl: data.targetUrl.trim(),
    virtualUsers: data.virtualUsers,
    status: "idle" as const,
    createdAt: now,
    lastRunAt: null,
  };

  await updateTests((tests) => [...tests, newTest]);
  broadcast({ type: "snapshot", payload: await getSnapshot() });
}

async function handleStartTest(testId: string) {
  const tests = await getTests();
  const test = tests.find((t) => t.id === testId);
  if (!test || test.status === "running") return;

  const timestamp = Date.now();
  await updateLiveMetrics((metrics) => {
    const next = new Map(metrics);
    next.set(testId, createInitialMetrics(testId, test.virtualUsers, timestamp));
    return next;
  });

  await updateTests((tests) =>
    tests.map((t) =>
      t.id === testId ? { ...t, status: "running" as const } : t,
    ),
  );

  await startTickIfNeeded();
  broadcast({ type: "snapshot", payload: await getSnapshot() });
}

async function handleStopTest(testId: string) {
  const tests = await getTests();
  const test = tests.find((t) => t.id === testId);
  if (!test || test.status !== "running") return;

  const metrics = await getLiveMetrics();
  const metric = metrics.get(testId) ?? createInitialMetrics(testId, test.virtualUsers);
  const completedAt = new Date().toISOString();
  const startedAt = new Date(
    metric.timestamp - metric.duration * 1_000,
  ).toISOString();

  await updateLiveMetrics((m) => {
    const next = new Map(m);
    next.delete(testId);
    return next;
  });

  await updateTests((tests) =>
    tests.map((t) =>
      t.id === testId
        ? { ...t, status: "stopped" as const, lastRunAt: completedAt }
        : t,
    ),
  );

  await updateRuns((runs) => [
    {
      id: newId("run"),
      testId,
      testName: test.name,
      status: "stopped" as const,
      startedAt,
      completedAt,
      duration: metric.duration,
      throughput: metric.throughput,
      avgResponseTime: metric.avgResponseTime,
      errorRate: metric.errorRate,
    },
    ...runs,
  ]);

  await startTickIfNeeded();
  broadcast({ type: "snapshot", payload: await getSnapshot() });
}

async function handleDeleteTest(testId: string) {
  await updateLiveMetrics((m) => {
    const next = new Map(m);
    next.delete(testId);
    return next;
  });

  await updateTests((tests) => tests.filter((t) => t.id !== testId));

  await startTickIfNeeded();
  broadcast({ type: "snapshot", payload: await getSnapshot() });
}

// ── WebSocket server ─────────────────────────────────────────────

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

  getSnapshot().then((snapshot) => {
    ws.send(
      JSON.stringify({
        type: "snapshot",
        payload: snapshot,
      } satisfies ServerMessage),
    );
  });

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

// ── Health check server ──────────────────────────────────────────

const healthServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (req.url === "/health") {
    const redisOk = await isRedisConnected();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: redisOk ? "healthy" : "degraded",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        redis: redisOk ? "connected" : "disconnected",
      }),
    );
  } else {
    res.writeHead(404);
    res.end();
  }
});

healthServer.listen(9090, "0.0.0.0", () => {
  console.log(`[health] Health check server on http://0.0.0.0:9090`);
});

// ── Startup ──────────────────────────────────────────────────────

async function start() {
  console.log("[startup] Connecting to Redis...");
  const redisConnected = await connectRedis();
  if (redisConnected) {
    console.log("[startup] Redis connected");
  } else {
    console.log("[startup] Redis not available, using in-memory state");
  }

  console.log("[startup] Hydrating state...");
  await hydrate();
  console.log("[startup] State hydrated");

  // Handle graceful shutdown
  const shutdown = async () => {
    console.log("[shutdown] Starting graceful shutdown...");
    if (tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
    await disconnectRedis();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

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
}

start().catch((err) => {
  console.error("[startup] Failed to start:", err);
  process.exit(1);
});
