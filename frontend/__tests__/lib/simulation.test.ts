import { describe, expect, it, vi } from "vitest";

import {
  clampTrendData,
  createInitialMetrics,
  generateNextMetrics,
} from "@/lib/simulation";

describe("simulation helpers", () => {
  it("creates predictable initial metrics from virtual users", () => {
    expect(createInitialMetrics("test-1", 250, 123)).toEqual({
      testId: "test-1",
      duration: 0,
      throughput: 200,
      avgResponseTime: 700,
      errorRate: 1.5,
      timestamp: 123,
    });
  });

  it("increments duration and produces bounded next metrics", () => {
    vi.spyOn(Math, "random").mockReturnValue(1);
    const current = {
      testId: "test-1",
      duration: 7,
      throughput: 100,
      avgResponseTime: 500,
      errorRate: 99.9,
      timestamp: 100,
    };

    expect(generateNextMetrics(current, 100, 200)).toEqual({
      testId: "test-1",
      duration: 8,
      throughput: 108,
      avgResponseTime: 560,
      errorRate: 100,
      timestamp: 200,
    });
  });

  it("clamps low throughput, response time, and error rate", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const current = {
      testId: "test-1",
      duration: 0,
      throughput: 0,
      avgResponseTime: 1,
      errorRate: 0.1,
      timestamp: 100,
    };

    expect(generateNextMetrics(current, 1, 200)).toMatchObject({
      duration: 1,
      throughput: 1,
      avgResponseTime: 50,
      errorRate: 0,
      timestamp: 200,
    });
  });

  it("retains the latest requested number of points", () => {
    expect(clampTrendData([1, 2, 3, 4], 2)).toEqual([3, 4]);
    expect(clampTrendData([1, 2], 30)).toEqual([1, 2]);
  });

  it("creates initial metrics with default timestamp", () => {
    const before = Date.now();
    const metrics = createInitialMetrics("test-1", 100);
    const after = Date.now();

    expect(metrics.timestamp).toBeGreaterThanOrEqual(before);
    expect(metrics.timestamp).toBeLessThanOrEqual(after);
  });

  it("creates initial metrics with minimum bounds", () => {
    const metrics = createInitialMetrics("test-1", 1);
    expect(metrics.throughput).toBeGreaterThanOrEqual(1);
    expect(metrics.avgResponseTime).toBeGreaterThanOrEqual(50);
  });

  it("generates metrics with random walk variation", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5); // Middle of range
    const current = {
      testId: "test-1",
      duration: 5,
      throughput: 100,
      avgResponseTime: 300,
      errorRate: 2,
      timestamp: 100,
    };

    const next = generateNextMetrics(current, 100, 200);
    expect(next.duration).toBe(6);
    expect(next.throughput).toBeGreaterThan(0);
    expect(next.avgResponseTime).toBeGreaterThanOrEqual(50);
    expect(next.errorRate).toBeGreaterThanOrEqual(0);
    expect(next.errorRate).toBeLessThanOrEqual(100);
    vi.restoreAllMocks();
  });

  it("clamps trend data to empty array", () => {
    expect(clampTrendData([], 10)).toEqual([]);
  });

  it("clamps trend data with exact limit", () => {
    const data = [1, 2, 3, 4, 5];
    expect(clampTrendData(data, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("clamps trend data with larger limit than array", () => {
    const data = [1, 2, 3];
    expect(clampTrendData(data, 10)).toEqual([1, 2, 3]);
  });
});
