import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockData } from "@/data/mock-data";
import {
  selectActiveTests,
  selectAvgResponseTime,
  selectCompletedRuns,
  selectRecentRuns,
  selectRunningTests,
  selectTotalTests,
  useTestStore,
} from "@/store/test-store";
import type { TestStore } from "@/store/test-store";

const resetStore = () => {
  useTestStore.setState({
    hydrated: false,
    connected: false,
    sendMessage: () => {},
    tests: [],
    runs: [],
    liveMetrics: new Map(),
    trendData: [],
    infrastructure: [],
  });
};

describe("test store", () => {
  beforeEach(() => {
    resetStore();
    vi.restoreAllMocks();
  });

  it("hydrates exactly once with seeded live metrics for running tests", () => {
    const store = useTestStore.getState();
    store.hydrate();
    const initial = useTestStore.getState();

    expect(initial.hydrated).toBe(true);
    expect(initial.tests).toHaveLength(9);
    expect(initial.liveMetrics.size).toBe(5);

    initial.hydrate();
    expect(useTestStore.getState().tests).toHaveLength(9);
  });

  it("creates an idle test with normalized input", () => {
    useTestStore.getState().createTest({
      name: "  New API Load  ",
      description: "  A description  ",
      scriptType: "HTTP",
      targetUrl: " https://api.example.com/new ",
      virtualUsers: 120,
    });

    const test = useTestStore.getState().tests[0];
    expect(test).toMatchObject({
      name: "New API Load",
      description: "A description",
      targetUrl: "https://api.example.com/new",
      status: "idle",
      virtualUsers: 120,
    });
    expect(test?.id).toMatch(/^test-/);
  });

  it("starts idle tests and ignores missing or already-running tests", () => {
    useTestStore.getState().createTest({
      name: "Start me",
      scriptType: "JMeter",
      targetUrl: "https://example.com",
      virtualUsers: 50,
    });
    const testId = useTestStore.getState().tests[0]!.id;

    useTestStore.getState().startTest("missing");
    useTestStore.getState().startTest(testId);
    const started = useTestStore.getState();
    const firstMetrics = started.liveMetrics.get(testId);

    expect(started.tests[0]?.status).toBe("running");
    expect(firstMetrics).toMatchObject({ duration: 0, throughput: 40 });

    useTestStore.getState().startTest(testId);
    expect(useTestStore.getState().liveMetrics.get(testId)).toBe(firstMetrics);
  });

  it("stops a running test, finalizes its run, and ignores invalid stops", () => {
    useTestStore.getState().createTest({
      name: "Stop me",
      scriptType: "HTTP",
      targetUrl: "https://example.com",
      virtualUsers: 100,
    });
    const testId = useTestStore.getState().tests[0]!.id;
    useTestStore.getState().startTest(testId);
    useTestStore.getState().tick();
    useTestStore.getState().stopTest(testId);

    const stopped = useTestStore.getState();
    expect(stopped.tests[0]).toMatchObject({ status: "stopped" });
    expect(stopped.liveMetrics.has(testId)).toBe(false);
    expect(stopped.runs[0]).toMatchObject({
      testId,
      testName: "Stop me",
      status: "stopped",
      duration: 1,
    });

    useTestStore.getState().stopTest(testId);
    useTestStore.getState().stopTest("missing");
    expect(useTestStore.getState().runs).toHaveLength(1);
  });

  it("deletes tests and associated live metrics", () => {
    useTestStore.getState().createTest({
      name: "Delete me",
      scriptType: "HTTP",
      targetUrl: "https://example.com",
      virtualUsers: 25,
    });
    const testId = useTestStore.getState().tests[0]!.id;
    useTestStore.getState().startTest(testId);
    useTestStore.getState().deleteTest(testId);

    expect(useTestStore.getState().tests).toEqual([]);
    expect(useTestStore.getState().liveMetrics.size).toBe(0);
  });

  it("ticks running tests and retains only thirty trend points", () => {
    useTestStore.getState().hydrate();
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    for (let index = 0; index < 12; index += 1) {
      useTestStore.getState().tick();
    }

    const state = useTestStore.getState();
    expect(state.trendData).toHaveLength(30);
    expect(state.liveMetrics.size).toBe(5);
    expect(
      [...state.liveMetrics.values()].every((metrics) => metrics.duration === 12),
    ).toBe(true);
    expect(state.trendData.at(-1)).toMatchObject({ throughput: expect.any(Number) });
  });

  it("does nothing when no tests are running", () => {
    const seed = createMockData(0);
    const idleTests = seed.tests.map((test) => ({ ...test, status: "idle" as const }));
    useTestStore.setState({ tests: idleTests, trendData: seed.trendData });
    useTestStore.getState().tick();

    expect(useTestStore.getState().trendData).toHaveLength(20);
    expect(useTestStore.getState().liveMetrics.size).toBe(0);
  });

  it("exports selectors with correct empty and populated results", () => {
    const empty = useTestStore.getState();
    expect(selectTotalTests(empty)).toBe(0);
    expect(selectRunningTests(empty)).toBe(0);
    expect(selectCompletedRuns(empty)).toBe(0);
    expect(selectAvgResponseTime(empty)).toBe(0);
    expect(selectActiveTests(empty)).toEqual([]);
    expect(selectRecentRuns(empty)).toEqual([]);

    useTestStore.getState().hydrate();
    const state: TestStore = useTestStore.getState();
    expect(selectTotalTests(state)).toBe(9);
    expect(selectRunningTests(state)).toBe(5);
    expect(selectCompletedRuns(state)).toBeGreaterThan(0);
    expect(selectAvgResponseTime(state)).toBeGreaterThan(0);
    expect(selectActiveTests(state)).toHaveLength(7);
    expect(selectRecentRuns(state)).toHaveLength(10);
    expect(
      selectRecentRuns(state)[0]!.completedAt >=
        selectRecentRuns(state)[1]!.completedAt,
    ).toBe(true);
  });

  it("applySnapshot replaces state from server", () => {
    useTestStore.getState().applySnapshot({
      tests: [{ id: "t1", name: "Server Test", description: "", scriptType: "HTTP", targetUrl: "https://a.com", virtualUsers: 100, status: "running", createdAt: "", lastRunAt: null }],
      runs: [],
      liveMetrics: { t1: { testId: "t1", duration: 5, throughput: 80, avgResponseTime: 200, errorRate: 1, timestamp: Date.now() } },
      trendData: [{ timestamp: new Date().toISOString(), responseTime: 200, throughput: 80 }],
      infrastructure: [],
    });

    const state = useTestStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.tests).toHaveLength(1);
    expect(state.tests[0].name).toBe("Server Test");
    expect(state.liveMetrics.size).toBe(1);
    expect(state.trendData).toHaveLength(1);
  });

  it("applyTickUpdate replaces liveMetrics and trendData", () => {
    useTestStore.getState().hydrate();
    useTestStore.getState().applyTickUpdate({
      liveMetrics: { t1: { testId: "t1", duration: 10, throughput: 90, avgResponseTime: 180, errorRate: 0.5, timestamp: Date.now() } },
      trendData: [{ timestamp: new Date().toISOString(), responseTime: 180, throughput: 90 }],
    });

    const state = useTestStore.getState();
    expect(state.liveMetrics.size).toBe(1);
    expect(state.liveMetrics.get("t1")?.throughput).toBe(90);
    expect(state.trendData).toHaveLength(1);
  });

  it("dispatchCreateTest sends via WebSocket when connected", () => {
    const sendMock = vi.fn();
    useTestStore.setState({ connected: true, sendMessage: sendMock });

    useTestStore.getState().dispatchCreateTest({
      name: "WS Test",
      scriptType: "HTTP",
      targetUrl: "https://a.com",
      virtualUsers: 100,
    });

    expect(sendMock).toHaveBeenCalledWith({
      type: "createTest",
      payload: { name: "WS Test", scriptType: "HTTP", targetUrl: "https://a.com", virtualUsers: 100 },
    });
    expect(useTestStore.getState().tests).toHaveLength(0);
  });

  it("dispatchStartTest sends via WebSocket when connected", () => {
    useTestStore.getState().hydrate();
    const sendMock = vi.fn();
    useTestStore.setState({ connected: true, sendMessage: sendMock });
    const testId = useTestStore.getState().tests[0].id;

    useTestStore.getState().dispatchStartTest(testId);

    expect(sendMock).toHaveBeenCalledWith({ type: "startTest", payload: { testId } });
  });

  it("dispatchStopTest sends via WebSocket when connected", () => {
    useTestStore.getState().hydrate();
    const sendMock = vi.fn();
    useTestStore.setState({ connected: true, sendMessage: sendMock });
    const testId = useTestStore.getState().tests.find(t => t.status === "running")!.id;

    useTestStore.getState().dispatchStopTest(testId);

    expect(sendMock).toHaveBeenCalledWith({ type: "stopTest", payload: { testId } });
  });

  it("dispatchDeleteTest sends via WebSocket when connected", () => {
    useTestStore.getState().hydrate();
    const sendMock = vi.fn();
    useTestStore.setState({ connected: true, sendMessage: sendMock });
    const testId = useTestStore.getState().tests[0].id;

    useTestStore.getState().dispatchDeleteTest(testId);

    expect(sendMock).toHaveBeenCalledWith({ type: "deleteTest", payload: { testId } });
  });

  it("dispatch functions fall back to local actions when not connected", () => {
    useTestStore.setState({ connected: false });

    useTestStore.getState().dispatchCreateTest({
      name: "Local Test",
      scriptType: "HTTP",
      targetUrl: "https://a.com",
      virtualUsers: 50,
    });

    expect(useTestStore.getState().tests).toHaveLength(1);
    expect(useTestStore.getState().tests[0].name).toBe("Local Test");
  });

  it("adds, updates, and removes SLA thresholds", () => {
    const initial = useTestStore.getState().slaThresholds;
    expect(initial.length).toBeGreaterThan(0);

    useTestStore.getState().addSLAThreshold({
      name: "Custom SLA",
      metric: "errorRate",
      condition: "lessThan",
      value: 2,
      enabled: true,
    });

    const added = useTestStore.getState().slaThresholds;
    expect(added.length).toBe(initial.length + 1);
    const newThreshold = added[added.length - 1];
    expect(newThreshold.name).toBe("Custom SLA");

    useTestStore.getState().updateSLAThreshold(newThreshold.id, { enabled: false });
    expect(useTestStore.getState().slaThresholds.find(t => t.id === newThreshold.id)?.enabled).toBe(false);

    useTestStore.getState().removeSLAThreshold(newThreshold.id);
    expect(useTestStore.getState().slaThresholds.length).toBe(initial.length);
  });

  it("toggles run selection and limits to 2", () => {
    useTestStore.getState().toggleRunSelection("r1");
    expect(useTestStore.getState().selectedRunIds).toEqual(["r1"]);

    useTestStore.getState().toggleRunSelection("r2");
    expect(useTestStore.getState().selectedRunIds).toEqual(["r1", "r2"]);

    // Adding a third replaces the first
    useTestStore.getState().toggleRunSelection("r3");
    expect(useTestStore.getState().selectedRunIds).toEqual(["r2", "r3"]);

    // Deselecting works
    useTestStore.getState().toggleRunSelection("r2");
    expect(useTestStore.getState().selectedRunIds).toEqual(["r3"]);

    useTestStore.getState().clearRunSelection();
    expect(useTestStore.getState().selectedRunIds).toEqual([]);
  });

  it("checks SLA violations and records them", () => {
    const run = {
      id: "test-run",
      testId: "t1",
      testName: "Test",
      status: "completed" as const,
      startedAt: "2025-01-01T10:00:00Z",
      completedAt: "2025-01-01T10:01:00Z",
      duration: 60,
      throughput: 50, // Below minimum throughput threshold
      avgResponseTime: 600, // Above response time threshold
      errorRate: 0.5,
    };

    useTestStore.getState().checkSLAViolations(run);
    const violations = useTestStore.getState().slaViolations;
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some(v => v.runId === "test-run")).toBe(true);
  });

  it("saves, uses, and deletes templates", () => {
    expect(useTestStore.getState().templates).toHaveLength(0);

    useTestStore.getState().saveTemplate({
      name: "API Test Template",
      description: "Test API performance",
      scriptType: "HTTP",
      targetUrl: "https://api.example.com/test",
      virtualUsers: 200,
    });

    const templates = useTestStore.getState().templates;
    expect(templates).toHaveLength(1);
    expect(templates[0].name).toBe("API Test Template");
    expect(templates[0].usageCount).toBe(0);

    // Create test from template
    useTestStore.getState().createTestFromTemplate(templates[0].id);
    expect(useTestStore.getState().tests).toHaveLength(1);
    expect(useTestStore.getState().tests[0].name).toBe("API Test Template");
    expect(useTestStore.getState().templates[0].usageCount).toBe(1);

    // Delete template
    useTestStore.getState().deleteTemplate(templates[0].id);
    expect(useTestStore.getState().templates).toHaveLength(0);
  });

  it("calculates performance stats correctly", () => {
    useTestStore.getState().hydrate();
    const stats = useTestStore.getState().getPerformanceStats();

    expect(stats.totalRuns).toBeGreaterThan(0);
    expect(stats.avgResponseTime).toBeGreaterThan(0);
    expect(stats.p50ResponseTime).toBeGreaterThan(0);
    expect(stats.p90ResponseTime).toBeGreaterThan(0);
    expect(stats.p95ResponseTime).toBeGreaterThan(0);
    expect(stats.p99ResponseTime).toBeGreaterThan(0);
    expect(stats.avgThroughput).toBeGreaterThan(0);
    expect(stats.bestRun).not.toBeNull();
    expect(stats.worstRun).not.toBeNull();
    expect(stats.successRate).toBeGreaterThanOrEqual(0);
    expect(stats.successRate).toBeLessThanOrEqual(100);
  });

  it("manages notifications correctly", () => {
    expect(useTestStore.getState().notifications).toHaveLength(0);
    expect(useTestStore.getState().unreadNotificationCount()).toBe(0);

    useTestStore.getState().addNotification({
      type: "test_complete",
      title: "Test Completed",
      message: "Login test finished successfully",
    });

    expect(useTestStore.getState().notifications).toHaveLength(1);
    expect(useTestStore.getState().unreadNotificationCount()).toBe(1);

    const notifId = useTestStore.getState().notifications[0].id;
    useTestStore.getState().markNotificationRead(notifId);
    expect(useTestStore.getState().unreadNotificationCount()).toBe(0);

    useTestStore.getState().clearNotifications();
    expect(useTestStore.getState().notifications).toHaveLength(0);
  });

  it("creates, updates, and deletes schedules", () => {
    expect(useTestStore.getState().schedules).toHaveLength(0);

    useTestStore.getState().createSchedule({
      testId: "test-1",
      testName: "Test Schedule",
      frequency: "daily",
      nextRunAt: "2025-12-01T10:00:00Z",
      lastRunAt: null,
      enabled: true,
      createdBy: "user-1",
    });

    expect(useTestStore.getState().schedules).toHaveLength(1);
    const scheduleId = useTestStore.getState().schedules[0].id;

    useTestStore.getState().updateSchedule(scheduleId, { enabled: false });
    expect(useTestStore.getState().schedules[0].enabled).toBe(false);

    useTestStore.getState().deleteSchedule(scheduleId);
    expect(useTestStore.getState().schedules).toHaveLength(0);
  });

  it("manages test selection for bulk operations", () => {
    expect(useTestStore.getState().selectedTestIds).toHaveLength(0);

    useTestStore.getState().toggleTestSelection("test-1");
    expect(useTestStore.getState().selectedTestIds).toEqual(["test-1"]);

    useTestStore.getState().toggleTestSelection("test-2");
    expect(useTestStore.getState().selectedTestIds).toEqual(["test-1", "test-2"]);

    useTestStore.getState().toggleTestSelection("test-1");
    expect(useTestStore.getState().selectedTestIds).toEqual(["test-2"]);

    useTestStore.getState().clearTestSelection();
    expect(useTestStore.getState().selectedTestIds).toHaveLength(0);
  });

  it("adds and retrieves timeline events", () => {
    expect(useTestStore.getState().timeline).toHaveLength(0);

    useTestStore.getState().addTimelineEvent({
      testId: "test-1",
      testName: "Test Event",
      type: "started",
      timestamp: "2025-01-01T10:00:00Z",
    });

    useTestStore.getState().addTimelineEvent({
      testId: "test-2",
      testName: "Test Event 2",
      type: "completed",
      timestamp: "2025-01-01T10:01:00Z",
      metadata: { duration: 60, throughput: 100 },
    });

    const allEvents = useTestStore.getState().getTimeline();
    expect(allEvents).toHaveLength(2);

    const test1Events = useTestStore.getState().getTimeline("test-1");
    expect(test1Events).toHaveLength(1);
    expect(test1Events[0].type).toBe("started");
  });

  it("creates test from template", () => {
    useTestStore.getState().saveTemplate({
      name: "Template Test",
      description: "From template",
      scriptType: "HTTP",
      targetUrl: "https://template.example.com",
      virtualUsers: 100,
    });

    const templateId = useTestStore.getState().templates[0].id;
    expect(useTestStore.getState().templates[0].usageCount).toBe(0);

    useTestStore.getState().createTestFromTemplate(templateId);

    expect(useTestStore.getState().tests).toHaveLength(1);
    expect(useTestStore.getState().tests[0].name).toBe("Template Test");
    expect(useTestStore.getState().templates[0].usageCount).toBe(1);
  });

  it("ignores createTestFromTemplate with invalid template", () => {
    useTestStore.getState().createTestFromTemplate("nonexistent");
    expect(useTestStore.getState().tests).toHaveLength(0);
  });

  it("performs bulk start, stop, and delete", () => {
    // Create some tests
    useTestStore.getState().createTest({ name: "Test 1", scriptType: "HTTP", targetUrl: "https://a.com", virtualUsers: 50 });
    useTestStore.getState().createTest({ name: "Test 2", scriptType: "HTTP", targetUrl: "https://b.com", virtualUsers: 100 });

    const testIds = useTestStore.getState().tests.map((t) => t.id);

    // Bulk start
    useTestStore.getState().bulkStartTests(testIds);
    expect(useTestStore.getState().tests.every((t) => t.status === "running")).toBe(true);

    // Bulk stop
    useTestStore.getState().bulkStopTests(testIds);
    expect(useTestStore.getState().tests.every((t) => t.status === "stopped")).toBe(true);

    // Bulk delete
    useTestStore.getState().bulkDeleteTests(testIds);
    expect(useTestStore.getState().tests).toHaveLength(0);
    expect(useTestStore.getState().selectedTestIds).toHaveLength(0);
  });

  it("handles SLA violations with different conditions", () => {
    // Test greaterThan condition
    useTestStore.getState().addSLAThreshold({
      name: "High Throughput",
      metric: "throughput",
      condition: "greaterThan",
      value: 1000,
      enabled: true,
    });

    const run = {
      id: "test-run-2",
      testId: "t1",
      testName: "Test",
      status: "completed" as const,
      startedAt: "2025-01-01T10:00:00Z",
      completedAt: "2025-01-01T10:01:00Z",
      duration: 60,
      throughput: 500, // Below threshold
      avgResponseTime: 100,
      errorRate: 0.5,
    };

    useTestStore.getState().checkSLAViolations(run);
    const violations = useTestStore.getState().slaViolations;
    expect(violations.some((v) => v.runId === "test-run-2")).toBe(true);
  });

  it("handles disabled SLA thresholds", () => {
    // Clear default thresholds and add only disabled one
    useTestStore.setState({ slaThresholds: [], slaViolations: [] });

    useTestStore.getState().addSLAThreshold({
      name: "Disabled Threshold",
      metric: "errorRate",
      condition: "lessThan",
      value: 0,
      enabled: false,
    });

    const run = {
      id: "test-run-3",
      testId: "t1",
      testName: "Test",
      status: "completed" as const,
      startedAt: "2025-01-01T10:00:00Z",
      completedAt: "2025-01-01T10:01:00Z",
      duration: 60,
      throughput: 100,
      avgResponseTime: 100,
      errorRate: 50, // Would violate if enabled
    };

    useTestStore.getState().checkSLAViolations(run);
    // Should not add any violations since threshold is disabled
    expect(useTestStore.getState().slaViolations).toHaveLength(0);
  });

  it("calculates performance stats for specific test", () => {
    useTestStore.setState({
      runs: [
        { id: "r1", testId: "t1", testName: "Test 1", status: "completed", startedAt: "2025-01-01T10:00:00Z", completedAt: "2025-01-01T10:01:00Z", duration: 60, throughput: 100, avgResponseTime: 200, errorRate: 1 },
        { id: "r2", testId: "t2", testName: "Test 2", status: "completed", startedAt: "2025-01-01T10:00:00Z", completedAt: "2025-01-01T10:01:00Z", duration: 120, throughput: 200, avgResponseTime: 300, errorRate: 2 },
      ],
    });

    const stats = useTestStore.getState().getPerformanceStats("t1");
    expect(stats.totalRuns).toBe(2);
    expect(stats.avgResponseTime).toBe(200);
  });

  it("returns zero stats when no runs", () => {
    useTestStore.setState({ runs: [] });
    const stats = useTestStore.getState().getPerformanceStats();
    expect(stats.totalRuns).toBe(0);
    expect(stats.avgResponseTime).toBe(0);
  });

  it("handles SLA violations triggering browser notification", () => {
    // Mock Notification
    const mockNotification = vi.fn();
    vi.stubGlobal("Notification", mockNotification);

    useTestStore.setState({ slaThresholds: [], slaViolations: [] });

    useTestStore.getState().addSLAThreshold({
      name: "Test Threshold",
      metric: "avgResponseTime",
      condition: "lessThan",
      value: 100,
      enabled: true,
    });

    const run = {
      id: "test-run-4",
      testId: "t1",
      testName: "Test",
      status: "completed" as const,
      startedAt: "2025-01-01T10:00:00Z",
      completedAt: "2025-01-01T10:01:00Z",
      duration: 60,
      throughput: 100,
      avgResponseTime: 200, // Violates threshold
      errorRate: 0.5,
    };

    useTestStore.getState().checkSLAViolations(run);
    expect(useTestStore.getState().slaViolations.length).toBeGreaterThan(0);

    vi.unstubAllGlobals();
  });
});
