import { getRedis, isRedisAvailable } from "./redis";
import { createMockData } from "../data/mock-data";
import {
  createInitialMetrics,
} from "./simulation";
import type {
  InfrastructureStatus,
  LiveMetrics,
  Run,
  Test,
  TrendPoint,
} from "../types";

const KEYS = {
  TESTS: "speedrunner:tests",
  RUNS: "speedrunner:runs",
  LIVE_METRICS: "speedrunner:liveMetrics",
  TREND_DATA: "speedrunner:trendData",
  INFRASTRUCTURE: "speedrunner:infrastructure",
  INITIALIZED: "speedrunner:initialized",
} as const;

// ── In-memory fallback state ─────────────────────────────────────

let memoryTests: Test[] = [];
let memoryRuns: Run[] = [];
let memoryLiveMetrics = new Map<string, LiveMetrics>();
let memoryTrendData: TrendPoint[] = [];
let memoryInfrastructure: InfrastructureStatus[] = [];
let memoryInitialized = false;

// ── Read operations ──────────────────────────────────────────────

export async function getTests(): Promise<Test[]> {
  if (!isRedisAvailable()) return memoryTests;
  const redis = getRedis();
  if (!redis) return memoryTests;
  const data = await redis.get(KEYS.TESTS);
  return data ? JSON.parse(data) : [];
}

export async function getRuns(): Promise<Run[]> {
  if (!isRedisAvailable()) return memoryRuns;
  const redis = getRedis();
  if (!redis) return memoryRuns;
  const data = await redis.get(KEYS.RUNS);
  return data ? JSON.parse(data) : [];
}

export async function getLiveMetrics(): Promise<Map<string, LiveMetrics>> {
  if (!isRedisAvailable()) return memoryLiveMetrics;
  const redis = getRedis();
  if (!redis) return memoryLiveMetrics;
  const data = await redis.get(KEYS.LIVE_METRICS);
  if (!data) return new Map();
  const obj: Record<string, LiveMetrics> = JSON.parse(data);
  return new Map(Object.entries(obj));
}

export async function getTrendData(): Promise<TrendPoint[]> {
  if (!isRedisAvailable()) return memoryTrendData;
  const redis = getRedis();
  if (!redis) return memoryTrendData;
  const data = await redis.get(KEYS.TREND_DATA);
  return data ? JSON.parse(data) : [];
}

export async function getInfrastructure(): Promise<InfrastructureStatus[]> {
  if (!isRedisAvailable()) return memoryInfrastructure;
  const redis = getRedis();
  if (!redis) return memoryInfrastructure;
  const data = await redis.get(KEYS.INFRASTRUCTURE);
  return data ? JSON.parse(data) : [];
}

export async function getSnapshot() {
  const [tests, runs, liveMetricsMap, trendData, infrastructure] =
    await Promise.all([
      getTests(),
      getRuns(),
      getLiveMetrics(),
      getTrendData(),
      getInfrastructure(),
    ]);

  const liveMetricsObj: Record<string, LiveMetrics> = {};
  liveMetricsMap.forEach((v, k) => {
    liveMetricsObj[k] = v;
  });

  return { tests, runs, liveMetrics: liveMetricsObj, trendData, infrastructure };
}

// ── Write operations ─────────────────────────────────────────────

export async function setTests(tests: Test[]): Promise<void> {
  memoryTests = tests;
  if (!isRedisAvailable()) return;
  const redis = getRedis();
  if (!redis) return;
  await redis.set(KEYS.TESTS, JSON.stringify(tests));
}

export async function setRuns(runs: Run[]): Promise<void> {
  memoryRuns = runs;
  if (!isRedisAvailable()) return;
  const redis = getRedis();
  if (!redis) return;
  await redis.set(KEYS.RUNS, JSON.stringify(runs));
}

export async function setLiveMetrics(
  metrics: Map<string, LiveMetrics>,
): Promise<void> {
  memoryLiveMetrics = metrics;
  if (!isRedisAvailable()) return;
  const redis = getRedis();
  if (!redis) return;
  const obj: Record<string, LiveMetrics> = {};
  metrics.forEach((v, k) => {
    obj[k] = v;
  });
  await redis.set(KEYS.LIVE_METRICS, JSON.stringify(obj));
}

export async function setTrendData(trendData: TrendPoint[]): Promise<void> {
  memoryTrendData = trendData;
  if (!isRedisAvailable()) return;
  const redis = getRedis();
  if (!redis) return;
  await redis.set(KEYS.TREND_DATA, JSON.stringify(trendData));
}

export async function setInfrastructure(
  infrastructure: InfrastructureStatus[],
): Promise<void> {
  memoryInfrastructure = infrastructure;
  if (!isRedisAvailable()) return;
  const redis = getRedis();
  if (!redis) return;
  await redis.set(KEYS.INFRASTRUCTURE, JSON.stringify(infrastructure));
}

// ── Hydration (seed initial data if empty) ───────────────────────

export async function hydrate(): Promise<void> {
  if (!isRedisAvailable()) {
    if (memoryInitialized) return;
    memoryInitialized = true;
  } else {
    const redis = getRedis();
    if (!redis) return;
    const initialized = await redis.get(KEYS.INITIALIZED);
    if (initialized) return;
    await redis.set(KEYS.INITIALIZED, "1");
  }

  const seed = createMockData();

  const liveMetrics = new Map<string, LiveMetrics>();
  seed.tests
    .filter((t) => t.status === "running")
    .forEach((t) => {
      liveMetrics.set(t.id, createInitialMetrics(t.id, t.virtualUsers));
    });

  await Promise.all([
    setTests(seed.tests),
    setRuns(seed.runs),
    setTrendData(seed.trendData),
    setInfrastructure(seed.infrastructure),
    setLiveMetrics(liveMetrics),
  ]);
}

// ── Atomic update helpers ────────────────────────────────────────

export async function updateTests(
  updater: (tests: Test[]) => Test[],
): Promise<Test[]> {
  const tests = await getTests();
  const updated = updater(tests);
  await setTests(updated);
  return updated;
}

export async function updateRuns(
  updater: (runs: Run[]) => Run[],
): Promise<Run[]> {
  const runs = await getRuns();
  const updated = updater(runs);
  await setRuns(updated);
  return updated;
}

export async function updateLiveMetrics(
  updater: (metrics: Map<string, LiveMetrics>) => Map<string, LiveMetrics>,
): Promise<Map<string, LiveMetrics>> {
  const metrics = await getLiveMetrics();
  const updated = updater(metrics);
  await setLiveMetrics(updated);
  return updated;
}

export async function updateTrendData(
  updater: (data: TrendPoint[]) => TrendPoint[],
): Promise<TrendPoint[]> {
  const data = await getTrendData();
  const updated = updater(data);
  await setTrendData(updated);
  return updated;
}
