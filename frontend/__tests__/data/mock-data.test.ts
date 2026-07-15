import { describe, expect, it } from "vitest";

import { createMockData } from "@/data/mock-data";

describe("createMockData", () => {
  it("provides realistic, internally consistent dashboard seed data", () => {
    const data = createMockData(Date.UTC(2026, 0, 10, 12));

    expect(data.tests).toHaveLength(9);
    expect(data.tests.filter((test) => test.status === "running")).toHaveLength(5);
    expect(data.tests.filter((test) => test.status === "completed")).toHaveLength(2);
    expect(data.tests.filter((test) => test.status === "idle")).toHaveLength(2);
    expect(data.runs).toHaveLength(24);
    expect(data.trendData).toHaveLength(20);
    expect(data.infrastructure).toHaveLength(3);
    expect(
      data.runs.every((run) => data.tests.some((test) => test.id === run.testId)),
    ).toBe(true);
    expect(data.trendData[0]?.timestamp).toBe("2026-01-10T10:06:00.000Z");
  });

  it("generates valid test data with all required fields", () => {
    const data = createMockData();

    data.tests.forEach((test) => {
      expect(test.id).toBeDefined();
      expect(test.name).toBeDefined();
      expect(test.scriptType).toMatch(/^(HTTP|TruClient|JMeter)$/);
      expect(test.targetUrl).toMatch(/^https?:\/\//);
      expect(test.virtualUsers).toBeGreaterThan(0);
      expect(test.status).toMatch(/^(idle|running|completed|stopped|failed)$/);
      expect(test.createdAt).toBeDefined();
    });
  });

  it("generates valid run data with all required fields", () => {
    const data = createMockData();

    data.runs.forEach((run) => {
      expect(run.id).toBeDefined();
      expect(run.testId).toBeDefined();
      expect(run.testName).toBeDefined();
      expect(run.status).toMatch(/^(completed|stopped|failed)$/);
      expect(run.startedAt).toBeDefined();
      expect(run.completedAt).toBeDefined();
      expect(run.duration).toBeGreaterThanOrEqual(0);
      expect(run.throughput).toBeGreaterThanOrEqual(0);
      expect(run.avgResponseTime).toBeGreaterThanOrEqual(0);
      expect(run.errorRate).toBeGreaterThanOrEqual(0);
    });
  });

  it("generates valid trend data", () => {
    const data = createMockData();

    data.trendData.forEach((point) => {
      expect(point.timestamp).toBeDefined();
      expect(point.responseTime).toBeGreaterThanOrEqual(0);
      expect(point.throughput).toBeGreaterThanOrEqual(0);
    });
  });

  it("generates valid infrastructure data", () => {
    const data = createMockData();

    expect(data.infrastructure).toHaveLength(3);
    data.infrastructure.forEach((item) => {
      expect(item.component).toBeDefined();
      expect(item.status).toMatch(/^(healthy|degraded|down)$/);
      expect(item.lastChecked).toBeDefined();
    });
  });

  it("generates consistent test counts", () => {
    const data = createMockData();

    const running = data.tests.filter((t) => t.status === "running").length;
    const completed = data.tests.filter((t) => t.status === "completed").length;
    const idle = data.tests.filter((t) => t.status === "idle").length;

    expect(running).toBe(5);
    expect(completed).toBe(2);
    expect(idle).toBe(2);
    expect(running + completed + idle).toBe(9);
  });

  it("uses different timestamps when called with different times", () => {
    const data1 = createMockData(Date.UTC(2026, 0, 1));
    const data2 = createMockData(Date.UTC(2026, 0, 2));

    expect(data1.trendData[0].timestamp).not.toBe(data2.trendData[0].timestamp);
  });
});
