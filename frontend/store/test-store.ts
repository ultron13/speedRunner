import { create } from "zustand";

import { createMockData } from "@/data/mock-data";
import {
  clampTrendData,
  createInitialMetrics,
  generateNextMetrics,
} from "@/lib/simulation";
import type {
  AlertNotification,
  CreateTestInput,
  InfrastructureStatus,
  LiveMetrics,
  PerformanceStats,
  Run,
  SLAThreshold,
  SLAViolation,
  Test,
  TestSchedule,
  TestTemplate,
  TimelineEvent,
  TrendPoint,
} from "@/types";
import type { ServerState, TickUpdate } from "@/lib/ws-types";

export interface TestStore {
  hydrated: boolean;
  connected: boolean;
  tests: Test[];
  runs: Run[];
  liveMetrics: Map<string, LiveMetrics>;
  trendData: TrendPoint[];
  infrastructure: InfrastructureStatus[];
  slaThresholds: SLAThreshold[];
  slaViolations: SLAViolation[];
  selectedRunIds: string[];
  selectedTestIds: string[];
  templates: TestTemplate[];
  notifications: AlertNotification[];
  schedules: TestSchedule[];
  timeline: TimelineEvent[];
  sendMessage: (msg: unknown) => void;
  hydrate: () => void;
  applySnapshot: (state: ServerState) => void;
  applyTickUpdate: (update: TickUpdate) => void;
  setConnected: (connected: boolean) => void;
  setSendMessage: (fn: (msg: unknown) => void) => void;
  dispatchCreateTest: (data: CreateTestInput) => void;
  dispatchStartTest: (testId: string) => void;
  dispatchStopTest: (testId: string) => void;
  dispatchDeleteTest: (testId: string) => void;
  createTest: (data: CreateTestInput) => void;
  startTest: (testId: string) => void;
  stopTest: (testId: string) => void;
  deleteTest: (testId: string) => void;
  tick: () => void;
  addSLAThreshold: (threshold: Omit<SLAThreshold, "id">) => void;
  updateSLAThreshold: (id: string, updates: Partial<SLAThreshold>) => void;
  removeSLAThreshold: (id: string) => void;
  toggleRunSelection: (runId: string) => void;
  clearRunSelection: () => void;
  checkSLAViolations: (run: Run) => void;
  saveTemplate: (template: Omit<TestTemplate, "id" | "createdAt" | "usageCount">) => void;
  deleteTemplate: (id: string) => void;
  createTestFromTemplate: (templateId: string) => void;
  getPerformanceStats: (testId?: string) => PerformanceStats;
  addNotification: (notification: Omit<AlertNotification, "id" | "timestamp" | "read">) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  unreadNotificationCount: () => number;
  createSchedule: (schedule: Omit<TestSchedule, "id" | "createdAt">) => void;
  updateSchedule: (id: string, updates: Partial<TestSchedule>) => void;
  deleteSchedule: (id: string) => void;
  toggleTestSelection: (testId: string) => void;
  clearTestSelection: () => void;
  bulkStartTests: (testIds: string[]) => void;
  bulkStopTests: (testIds: string[]) => void;
  bulkDeleteTests: (testIds: string[]) => void;
  addTimelineEvent: (event: Omit<TimelineEvent, "id">) => void;
  getTimeline: (testId?: string) => TimelineEvent[];
  replayTest: (runId: string) => void;
  cloneTestConfig: (testId: string) => CreateTestInput | null;
}

const newId = (prefix: string) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

const defaultSLAThresholds: SLAThreshold[] = [
  {
    id: "sla-1",
    name: "Response Time SLA",
    metric: "avgResponseTime",
    condition: "lessThan",
    value: 500,
    enabled: true,
  },
  {
    id: "sla-2",
    name: "Error Rate SLA",
    metric: "errorRate",
    condition: "lessThan",
    value: 5,
    enabled: true,
  },
  {
    id: "sla-3",
    name: "Minimum Throughput",
    metric: "throughput",
    condition: "greaterThan",
    value: 100,
    enabled: true,
  },
];

export const useTestStore = create<TestStore>((set, get) => ({
  hydrated: false,
  connected: false,
  tests: [],
  runs: [],
  liveMetrics: new Map(),
  trendData: [],
  infrastructure: [],
  slaThresholds: defaultSLAThresholds,
  slaViolations: [],
  selectedRunIds: [],
  selectedTestIds: [],
  templates: [],
  notifications: [],
  schedules: [],
  timeline: [],
  sendMessage: () => {},

  hydrate: () => {
    if (get().hydrated) return;

    const seed = createMockData();
    const liveMetrics = new Map<string, LiveMetrics>();
    seed.tests
      .filter((test) => test.status === "running")
      .forEach((test) => {
        liveMetrics.set(test.id, createInitialMetrics(test.id, test.virtualUsers));
      });

    set({ ...seed, liveMetrics, hydrated: true });
  },

  applySnapshot: (serverState) => {
    const lm = new Map<string, LiveMetrics>();
    Object.entries(serverState.liveMetrics).forEach(([k, v]) => lm.set(k, v));
    set({
      tests: serverState.tests as Test[],
      runs: serverState.runs as Run[],
      liveMetrics: lm,
      trendData: serverState.trendData,
      infrastructure: serverState.infrastructure as InfrastructureStatus[],
      hydrated: true,
    });
  },

  applyTickUpdate: (update) => {
    const lm = new Map<string, LiveMetrics>();
    Object.entries(update.liveMetrics).forEach(([k, v]) => lm.set(k, v));
    set({ liveMetrics: lm, trendData: update.trendData });
  },

  setConnected: (connected) => set({ connected }),

  setSendMessage: (fn) => set({ sendMessage: fn }),

  dispatchCreateTest: (data) => {
    const { connected, sendMessage, createTest } = get();
    if (connected) {
      sendMessage({ type: "createTest", payload: data });
    } else {
      createTest(data);
    }
  },

  dispatchStartTest: (testId) => {
    const { connected, sendMessage, startTest } = get();
    if (connected) {
      sendMessage({ type: "startTest", payload: { testId } });
    } else {
      startTest(testId);
    }
  },

  dispatchStopTest: (testId) => {
    const { connected, sendMessage, stopTest } = get();
    if (connected) {
      sendMessage({ type: "stopTest", payload: { testId } });
    } else {
      stopTest(testId);
    }
  },

  dispatchDeleteTest: (testId) => {
    const { connected, sendMessage, deleteTest } = get();
    if (connected) {
      sendMessage({ type: "deleteTest", payload: { testId } });
    } else {
      deleteTest(testId);
    }
  },

  createTest: (data) => {
    const now = new Date().toISOString();
    set((state) => ({
      tests: [
        ...state.tests,
        {
          id: newId("test"),
          name: data.name.trim(),
          description: data.description?.trim() ?? "",
          scriptType: data.scriptType,
          targetUrl: data.targetUrl.trim(),
          virtualUsers: data.virtualUsers,
          status: "idle",
          createdAt: now,
          lastRunAt: null,
        },
      ],
    }));
  },

  startTest: (testId) => {
    const test = get().tests.find((item) => item.id === testId);
    if (!test || test.status === "running") return;

    const timestamp = Date.now();
    set((state) => {
      const liveMetrics = new Map(state.liveMetrics);
      liveMetrics.set(
        testId,
        createInitialMetrics(testId, test.virtualUsers, timestamp),
      );

      return {
        tests: state.tests.map((item) =>
          item.id === testId ? { ...item, status: "running" } : item,
        ),
        liveMetrics,
      };
    });
  },

  stopTest: (testId) => {
    const state = get();
    const test = state.tests.find((item) => item.id === testId);
    if (!test || test.status !== "running") return;

    const metrics =
      state.liveMetrics.get(testId) ?? createInitialMetrics(testId, test.virtualUsers);
    const completedAt = new Date().toISOString();
    const startedAt = new Date(
      metrics.timestamp - metrics.duration * 1_000,
    ).toISOString();

    set((current) => {
      const liveMetrics = new Map(current.liveMetrics);
      liveMetrics.delete(testId);

      return {
        tests: current.tests.map((item) =>
          item.id === testId
            ? { ...item, status: "stopped", lastRunAt: completedAt }
            : item,
        ),
        runs: [
          {
            id: newId("run"),
            testId,
            testName: test.name,
            status: "stopped",
            startedAt,
            completedAt,
            duration: metrics.duration,
            throughput: metrics.throughput,
            avgResponseTime: metrics.avgResponseTime,
            errorRate: metrics.errorRate,
          },
          ...current.runs,
        ],
        liveMetrics,
      };
    });
  },

  deleteTest: (testId) => {
    set((state) => {
      const liveMetrics = new Map(state.liveMetrics);
      liveMetrics.delete(testId);
      return {
        tests: state.tests.filter((test) => test.id !== testId),
        liveMetrics,
      };
    });
  },

  tick: () => {
    const { tests, liveMetrics } = get();
    const runningTests = tests.filter((test) => test.status === "running");
    if (runningTests.length === 0) return;

    const timestamp = Date.now();
    const nextMetrics = new Map(liveMetrics);
    const activeMetrics: LiveMetrics[] = [];

    runningTests.forEach((test) => {
      const current =
        nextMetrics.get(test.id) ??
        createInitialMetrics(test.id, test.virtualUsers, timestamp);
      const next = generateNextMetrics(current, test.virtualUsers, timestamp);
      nextMetrics.set(test.id, next);
      activeMetrics.push(next);
    });

    const throughput = activeMetrics.reduce(
      (total, metrics) => total + metrics.throughput,
      0,
    );
    const responseTime = Math.round(
      activeMetrics.reduce((total, metrics) => total + metrics.avgResponseTime, 0) /
        activeMetrics.length,
    );

    set((state) => ({
      liveMetrics: nextMetrics,
      trendData: clampTrendData([
        ...state.trendData,
        { timestamp: new Date(timestamp).toISOString(), responseTime, throughput },
      ]),
    }));
  },

  addSLAThreshold: (threshold) => {
    set((state) => ({
      slaThresholds: [
        ...state.slaThresholds,
        { ...threshold, id: newId("sla") },
      ],
    }));
  },

  updateSLAThreshold: (id, updates) => {
    set((state) => ({
      slaThresholds: state.slaThresholds.map((t) =>
        t.id === id ? { ...t, ...updates } : t,
      ),
    }));
  },

  removeSLAThreshold: (id) => {
    set((state) => ({
      slaThresholds: state.slaThresholds.filter((t) => t.id !== id),
    }));
  },

  toggleRunSelection: (runId) => {
    set((state) => {
      const isSelected = state.selectedRunIds.includes(runId);
      if (isSelected) {
        return { selectedRunIds: state.selectedRunIds.filter((id) => id !== runId) };
      }
      if (state.selectedRunIds.length >= 2) {
        return { selectedRunIds: [state.selectedRunIds[1], runId] };
      }
      return { selectedRunIds: [...state.selectedRunIds, runId] };
    });
  },

  clearRunSelection: () => {
    set({ selectedRunIds: [] });
  },

  checkSLAViolations: (run) => {
    const { slaThresholds } = get();
    const newViolations: SLAViolation[] = [];

    slaThresholds.forEach((threshold) => {
      if (!threshold.enabled) return;

      let violated = false;
      const metricValue = run[threshold.metric];

      if (threshold.condition === "lessThan") {
        violated = metricValue >= threshold.value;
      } else {
        violated = metricValue <= threshold.value;
      }

      if (violated) {
        const unit =
          threshold.metric === "avgResponseTime"
            ? "ms"
            : threshold.metric === "errorRate"
              ? "%"
              : "req/s";
        newViolations.push({
          thresholdId: threshold.id,
          runId: run.id,
          metric: threshold.name,
          expected: `${threshold.condition === "lessThan" ? "<" : ">"} ${threshold.value}${unit}`,
          actual: `${metricValue}${unit}`,
          timestamp: run.completedAt,
        });
      }
    });

    if (newViolations.length > 0) {
      set((state) => ({
        slaViolations: [...newViolations, ...state.slaViolations].slice(0, 100),
      }));

      // Send browser notification for SLA violations
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "granted") {
          new Notification("SLA Violation Detected", {
            body: `${run.testName}: ${newViolations.length} threshold(s) exceeded`,
            icon: "/favicon.ico",
          });
        }
      }
    }
  },

  saveTemplate: (template) => {
    set((state) => ({
      templates: [
        ...state.templates,
        {
          ...template,
          id: newId("template"),
          createdAt: new Date().toISOString(),
          usageCount: 0,
        },
      ],
    }));
  },

  deleteTemplate: (id) => {
    set((state) => ({
      templates: state.templates.filter((t) => t.id !== id),
    }));
  },

  createTestFromTemplate: (templateId) => {
    const { templates, createTest } = get();
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    createTest({
      name: template.name,
      description: template.description,
      scriptType: template.scriptType,
      targetUrl: template.targetUrl,
      virtualUsers: template.virtualUsers,
    });

    // Increment usage count
    set((state) => ({
      templates: state.templates.map((t) =>
        t.id === templateId ? { ...t, usageCount: t.usageCount + 1 } : t,
      ),
    }));
  },

  getPerformanceStats: (testId) => {
    const { runs } = get();
    const filteredRuns = testId
      ? runs.filter((r) => r.testId === testId && r.status === "completed")
      : runs.filter((r) => r.status === "completed");

    if (filteredRuns.length === 0) {
      return {
        totalRuns: 0,
        avgResponseTime: 0,
        p50ResponseTime: 0,
        p90ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        avgThroughput: 0,
        avgErrorRate: 0,
        bestRun: null,
        worstRun: null,
        successRate: 0,
      };
    }

    const sortedByThroughput = [...filteredRuns].sort(
      (a, b) => b.throughput - a.throughput,
    );

    const percentile = (arr: number[], p: number) => {
      const index = Math.ceil((p / 100) * arr.length) - 1;
      return arr[Math.max(0, index)];
    };

    const responseTimes = filteredRuns.map((r) => r.avgResponseTime);
    const throughputs = filteredRuns.map((r) => r.throughput);
    const errorRates = filteredRuns.map((r) => r.errorRate);

    const totalRuns = runs.length;
    const completedRuns = runs.filter((r) => r.status === "completed").length;

    return {
      totalRuns,
      avgResponseTime: Math.round(
        responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      ),
      p50ResponseTime: percentile(responseTimes, 50),
      p90ResponseTime: percentile(responseTimes, 90),
      p95ResponseTime: percentile(responseTimes, 95),
      p99ResponseTime: percentile(responseTimes, 99),
      avgThroughput: Math.round(
        throughputs.reduce((a, b) => a + b, 0) / throughputs.length,
      ),
      avgErrorRate: Number(
        (errorRates.reduce((a, b) => a + b, 0) / errorRates.length).toFixed(2),
      ),
      bestRun: sortedByThroughput[0] ?? null,
      worstRun: sortedByThroughput[sortedByThroughput.length - 1] ?? null,
      successRate: totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0,
    };
  },

  addNotification: (notification) => {
    set((state) => ({
      notifications: [
        {
          ...notification,
          id: newId("notif"),
          timestamp: new Date().toISOString(),
          read: false,
        },
        ...state.notifications,
      ].slice(0, 50),
    }));
  },

  markNotificationRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      ),
    }));
  },

  clearNotifications: () => {
    set({ notifications: [] });
  },

  unreadNotificationCount: () => {
    return get().notifications.filter((n) => !n.read).length;
  },

  createSchedule: (schedule) => {
    set((state) => ({
      schedules: [
        ...state.schedules,
        { ...schedule, id: newId("schedule"), createdAt: new Date().toISOString() },
      ],
    }));
  },

  updateSchedule: (id, updates) => {
    set((state) => ({
      schedules: state.schedules.map((s) =>
        s.id === id ? { ...s, ...updates } : s,
      ),
    }));
  },

  deleteSchedule: (id) => {
    set((state) => ({
      schedules: state.schedules.filter((s) => s.id !== id),
    }));
  },

  toggleTestSelection: (testId) => {
    set((state) => {
      const isSelected = state.selectedTestIds.includes(testId);
      if (isSelected) {
        return { selectedTestIds: state.selectedTestIds.filter((id) => id !== testId) };
      }
      return { selectedTestIds: [...state.selectedTestIds, testId] };
    });
  },

  clearTestSelection: () => {
    set({ selectedTestIds: [] });
  },

  bulkStartTests: (testIds) => {
    const { startTest } = get();
    testIds.forEach((id) => startTest(id));
  },

  bulkStopTests: (testIds) => {
    const { stopTest } = get();
    testIds.forEach((id) => stopTest(id));
  },

  bulkDeleteTests: (testIds) => {
    const { deleteTest } = get();
    testIds.forEach((id) => deleteTest(id));
    set({ selectedTestIds: [] });
  },

  addTimelineEvent: (event) => {
    set((state) => ({
      timeline: [
        { ...event, id: newId("event") },
        ...state.timeline,
      ].slice(0, 100),
    }));
  },

  getTimeline: (testId) => {
    const { timeline } = get();
    if (testId) {
      return timeline.filter((e) => e.testId === testId);
    }
    return timeline;
  },

  replayTest: (runId) => {
    const { runs, tests, createTest, startTest } = get();
    const run = runs.find((r) => r.id === runId);
    if (!run) return;

    const originalTest = tests.find((t) => t.id === run.testId);
    if (!originalTest) return;

    const clonedId = newId("test");
    const now = new Date().toISOString();

    set((state) => ({
      tests: [
        ...state.tests,
        {
          id: clonedId,
          name: `${originalTest.name} (Replay)`,
          description: originalTest.description,
          scriptType: originalTest.scriptType,
          targetUrl: originalTest.targetUrl,
          virtualUsers: originalTest.virtualUsers,
          status: "idle",
          createdAt: now,
          lastRunAt: null,
        },
      ],
    }));

    startTest(clonedId);
  },

  cloneTestConfig: (testId) => {
    const test = get().tests.find((t) => t.id === testId);
    if (!test) return null;
    return {
      name: `${test.name} (Copy)`,
      description: test.description,
      scriptType: test.scriptType,
      targetUrl: test.targetUrl,
      virtualUsers: test.virtualUsers,
    };
  },
}));

export const selectTotalTests = (state: TestStore) => state.tests.length;
export const selectRunningTests = (state: TestStore) =>
  state.tests.filter((test) => test.status === "running").length;
export const selectCompletedRuns = (state: TestStore) =>
  state.runs.filter((run) => run.status === "completed").length;
export const selectAvgResponseTime = (state: TestStore) => {
  const completedRuns = state.runs.filter((run) => run.status === "completed");
  if (completedRuns.length === 0) return 0;
  return Math.round(
    completedRuns.reduce((total, run) => total + run.avgResponseTime, 0) /
      completedRuns.length,
  );
};
export const selectActiveTests = (state: TestStore) =>
  state.tests.filter((test) => test.status === "idle" || test.status === "running");
export const selectRecentRuns = (state: TestStore) =>
  [...state.runs]
    .sort(
      (first, second) =>
        new Date(second.completedAt).getTime() - new Date(first.completedAt).getTime(),
    )
    .slice(0, 10);
