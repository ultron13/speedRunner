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
});
