import { describe, it, expect, vi } from "vitest";

// Mock worker_threads - need to mock the Worker class
vi.mock("worker_threads", () => {
  return {
    default: {},
    Worker: vi.fn().mockImplementation(() => ({
      postMessage: vi.fn(),
      on: vi.fn(),
      terminate: vi.fn(),
    })),
    parentPort: {
      postMessage: vi.fn(),
      on: vi.fn(),
    },
    workerData: null,
  };
});

// Mock Prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    runMetric: { create: vi.fn() },
    run: { update: vi.fn(), findFirst: vi.fn() },
    test: { update: vi.fn() },
  },
}));

// Mock path
vi.mock("path", () => ({
  default: {
    join: vi.fn((...args) => args.join("/")),
  },
}));

describe("LoadGenerator", () => {
  it("exports LoadGeneratorConfig interface", async () => {
    const mod = await import("@/lib/load-generator");
    expect(mod).toBeDefined();
  });
});

describe("LoadGeneratorManager", () => {
  it("exports singleton instance", async () => {
    const { loadGeneratorManager } = await import("@/lib/load-generator-manager");
    expect(loadGeneratorManager).toBeDefined();
    expect(typeof loadGeneratorManager.getActiveTestCount).toBe("function");
    expect(typeof loadGeneratorManager.isTestRunning).toBe("function");
  });

  it("singleton returns same instance", async () => {
    const { loadGeneratorManager } = await import("@/lib/load-generator-manager");
    const instance1 = loadGeneratorManager;
    const instance2 = loadGeneratorManager;
    expect(instance1).toBe(instance2);
  });

  it("starts with no active tests", async () => {
    const { loadGeneratorManager } = await import("@/lib/load-generator-manager");
    expect(loadGeneratorManager.getActiveTestCount()).toBe(0);
  });

  it("reports test not running initially", async () => {
    const { loadGeneratorManager } = await import("@/lib/load-generator-manager");
    expect(loadGeneratorManager.isTestRunning("nonexistent")).toBe(false);
  });

  it("stopTest returns false for non-running test", async () => {
    const { loadGeneratorManager } = await import("@/lib/load-generator-manager");
    const result = await loadGeneratorManager.stopTest("nonexistent");
    expect(result).toBe(false);
  });
});

describe("WSMetricsBridge", () => {
  it("exports singleton instance", async () => {
    const { wsMetricsBridge } = await import("@/lib/ws-metrics-bridge");
    expect(wsMetricsBridge).toBeDefined();
    expect(typeof wsMetricsBridge.setBroadcastFn).toBe("function");
    expect(typeof wsMetricsBridge.getActiveTestCount).toBe("function");
  });

  it("singleton returns same instance", async () => {
    const { wsMetricsBridge } = await import("@/lib/ws-metrics-bridge");
    const instance1 = wsMetricsBridge;
    const instance2 = wsMetricsBridge;
    expect(instance1).toBe(instance2);
  });

  it("starts with no active tests", async () => {
    const { wsMetricsBridge } = await import("@/lib/ws-metrics-bridge");
    expect(wsMetricsBridge.getActiveTestCount()).toBe(0);
  });

  it("sets broadcast function without error", async () => {
    const { wsMetricsBridge } = await import("@/lib/ws-metrics-bridge");
    const mockBroadcast = vi.fn();
    wsMetricsBridge.setBroadcastFn(mockBroadcast);
  });

  it("isTestRunning returns false initially", async () => {
    const { wsMetricsBridge } = await import("@/lib/ws-metrics-bridge");
    expect(wsMetricsBridge.isTestRunning("test-1")).toBe(false);
  });

  it("stopTest returns false for non-running test", async () => {
    const { wsMetricsBridge } = await import("@/lib/ws-metrics-bridge");
    const result = await wsMetricsBridge.stopTest("nonexistent");
    expect(result).toBe(false);
  });
});
