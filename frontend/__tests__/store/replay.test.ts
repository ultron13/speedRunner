import { describe, it, expect, beforeEach } from "vitest";
import { useTestStore } from "@/store/test-store";
import type { Test, Run } from "@/types";

// Reset store between tests
beforeEach(() => {
  useTestStore.setState({
    tests: [],
    runs: [],
    liveMetrics: new Map(),
    selectedRunIds: [],
    selectedTestIds: [],
  });
});

function addTest(overrides: Partial<Test> = {}): Test {
  const test: Test = {
    id: "test-1",
    name: "Login Load Test",
    description: "Test login endpoint",
    scriptType: "HTTP",
    targetUrl: "https://example.com/login",
    virtualUsers: 50,
    status: "idle",
    createdAt: "2025-01-01T00:00:00Z",
    lastRunAt: null,
    ...overrides,
  };
  useTestStore.setState((state) => ({ tests: [...state.tests, test] }));
  return test;
}

function addRun(overrides: Partial<Run> = {}): Run {
  const run: Run = {
    id: "run-1",
    testId: "test-1",
    testName: "Login Load Test",
    status: "completed",
    startedAt: "2025-01-02T10:00:00Z",
    completedAt: "2025-01-02T10:05:00Z",
    duration: 300,
    throughput: 120,
    avgResponseTime: 150,
    errorRate: 0.5,
    ...overrides,
  };
  useTestStore.setState((state) => ({ runs: [...state.runs, run] }));
  return run;
}

describe("replayTest", () => {
  it("creates a cloned test and starts it", () => {
    addTest();
    addRun();

    useTestStore.getState().replayTest("run-1");

    const { tests } = useTestStore.getState();
    expect(tests).toHaveLength(2);

    const cloned = tests.find((t) => t.name.includes("(Replay)"));
    expect(cloned).toBeDefined();
    expect(cloned!.name).toBe("Login Load Test (Replay)");
    expect(cloned!.scriptType).toBe("HTTP");
    expect(cloned!.targetUrl).toBe("https://example.com/login");
    expect(cloned!.virtualUsers).toBe(50);
    expect(cloned!.status).toBe("running");
  });

  it("does nothing if run not found", () => {
    addTest();

    useTestStore.getState().replayTest("nonexistent-run");

    expect(useTestStore.getState().tests).toHaveLength(1);
  });

  it("does nothing if original test not found", () => {
    addRun({ testId: "nonexistent-test" });

    useTestStore.getState().replayTest("run-1");

    expect(useTestStore.getState().tests).toHaveLength(0);
  });
});

describe("cloneTestConfig", () => {
  it("returns cloned config from test", () => {
    addTest();

    const config = useTestStore.getState().cloneTestConfig("test-1");

    expect(config).toEqual({
      name: "Login Load Test (Copy)",
      description: "Test login endpoint",
      scriptType: "HTTP",
      targetUrl: "https://example.com/login",
      virtualUsers: 50,
    });
  });

  it("returns null if test not found", () => {
    const config = useTestStore.getState().cloneTestConfig("nonexistent");
    expect(config).toBeNull();
  });
});
