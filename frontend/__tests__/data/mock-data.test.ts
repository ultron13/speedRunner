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
});
