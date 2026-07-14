import type { LiveMetrics } from "@/types";

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

const randomWalk = (current: number, range: number) =>
  current + (Math.random() - 0.5) * range * 2;

export function createInitialMetrics(
  testId: string,
  virtualUsers: number,
  timestamp = Date.now(),
): LiveMetrics {
  return {
    testId,
    duration: 0,
    throughput: Math.max(1, Math.round(virtualUsers * 0.8)),
    avgResponseTime: Math.max(50, Math.round(200 + virtualUsers * 2)),
    errorRate: 1.5,
    timestamp,
  };
}

export function generateNextMetrics(
  current: LiveMetrics,
  virtualUsers: number,
  timestamp = Date.now(),
): LiveMetrics {
  const throughputRange = Math.max(1, virtualUsers * 0.8 * 0.1);
  const responseTimeRange = Math.max(1, (200 + virtualUsers * 2) * 0.15);

  return {
    testId: current.testId,
    duration: current.duration + 1,
    throughput: Math.max(
      1,
      Math.round(randomWalk(current.throughput, throughputRange)),
    ),
    avgResponseTime: Math.max(
      50,
      Math.round(randomWalk(current.avgResponseTime, responseTimeRange)),
    ),
    errorRate: Number(clamp(randomWalk(current.errorRate, 1), 0, 100).toFixed(2)),
    timestamp,
  };
}

export function clampTrendData<T>(points: readonly T[], limit = 30): T[] {
  return points.slice(-limit);
}
