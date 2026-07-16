import { create } from "zustand";

import { createMockData } from "@/data/mock-data";
import { apiClient, isGoBackendEnabled } from "@/lib/api-client";
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

function normalizeStatus(status: string): Test["status"] {
  return status.toLowerCase() as Test["status"];
}

function mapApiTest(t: Record<string, unknown>): Test {
  return {
    id: t.id as string,
    name: t.name as string,
    description: (t.description as string) || "",
    scriptType: t.scriptType as Test["scriptType"],
    targetUrl: t.targetUrl as string,
    virtualUsers: t.virtualUsers as number,
    status: normalizeStatus((t.status as string) || "idle"),
    createdAt:
      typeof t.createdAt === "string"
        ? t.createdAt
        : new Date(t.createdAt as string).toISOString(),
    lastRunAt: t.lastRunAt
      ? typeof t.lastRunAt === "string"
        ? t.lastRunAt
        : new Date(t.lastRunAt as string).toISOString()
      : null,
  };
}

function mapApiRunStatus(status: unknown): Run["status"] {
  // Normalize API/backend statuses to terminal run states used by the UI.
  const raw = String(status ?? "completed").toLowerCase();
  if (raw === "failed") return "failed";
  if (raw === "completed") return "completed";
  // running / idle / stopped / unknown → stopped for historical run rows
  return "stopped";
}

function mapApiRun(r: Record<string, unknown>): Run {
  return {
    id: r.id as string,
    testId: r.testId as string,
    testName: (r.testName as string) || "Unknown",
    status: mapApiRunStatus(r.status),
    startedAt:
      typeof r.startedAt === "string"
        ? r.startedAt
        : new Date(r.startedAt as string).toISOString(),
    completedAt: r.completedAt
      ? typeof r.completedAt === "string"
        ? r.completedAt
        : new Date(r.completedAt as string).toISOString()
      : new Date().toISOString(),
    duration: (r.duration as number) || 0,
    throughput: (r.throughput as number) || 0,
    avgResponseTime: (r.avgResponseTime as number) || 0,
    errorRate: (r.errorRate as number) || 0,
  };
}

function mapApiSLA(t: Record<string, unknown>): SLAThreshold {
  const metricRaw = String(t.metric || "avg_response_time").toLowerCase();
  let metric: SLAThreshold["metric"] = "avgResponseTime";
  if (metricRaw.includes("error")) metric = "errorRate";
  else if (metricRaw.includes("throughput")) metric = "throughput";

  const condRaw = String(t.condition || "lte").toLowerCase();
  const condition: SLAThreshold["condition"] =
    condRaw.includes("gt") || condRaw.includes("greater") ? "greaterThan" : "lessThan";

  return {
    id: t.id as string,
    name: (t.name as string) || "SLA",
    metric,
    condition,
    value: (t.value as number) || 0,
    enabled: t.enabled !== false,
  };
}

function mapApiTemplate(t: Record<string, unknown>): TestTemplate {
  return {
    id: t.id as string,
    name: (t.name as string) || "",
    description: (t.description as string) || "",
    scriptType: (t.scriptType as Test["scriptType"]) || "HTTP",
    targetUrl: (t.targetUrl as string) || "",
    virtualUsers: (t.virtualUsers as number) || 10,
    usageCount: (t.usageCount as number) || 0,
    createdAt:
      typeof t.createdAt === "string"
        ? t.createdAt
        : new Date((t.createdAt as string) || Date.now()).toISOString(),
  };
}

function mapApiSchedule(s: Record<string, unknown>): TestSchedule {
  const freq = String(s.frequency || "DAILY").toLowerCase() as TestSchedule["frequency"];
  return {
    id: s.id as string,
    testId: s.testId as string,
    testName: (s.testName as string) || (s.name as string) || "Scheduled test",
    frequency: freq,
    nextRunAt: s.nextRunAt
      ? typeof s.nextRunAt === "string"
        ? s.nextRunAt
        : new Date(s.nextRunAt as string).toISOString()
      : new Date().toISOString(),
    lastRunAt: s.lastRunAt
      ? typeof s.lastRunAt === "string"
        ? s.lastRunAt
        : new Date(s.lastRunAt as string).toISOString()
      : null,
    enabled: s.enabled !== false,
    createdAt:
      typeof s.createdAt === "string"
        ? s.createdAt
        : new Date((s.createdAt as string) || Date.now()).toISOString(),
    createdBy: "api",
  };
}

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
  /** Force re-fetch from Go API (e.g. after login). */
  rehydrateFromApi: () => Promise<void>;
  applyApiRefresh: (
    testsRes: { tests?: Array<Record<string, unknown>> },
    runsRes: { runs?: Array<Record<string, unknown>> },
  ) => void;
  applySnapshot: (state: ServerState) => void;
  applyTickUpdate: (update: TickUpdate) => void;
  setConnected: (connected: boolean) => void;
  setSendMessage: (fn: (msg: unknown) => void) => void;
  dispatchCreateTest: (data: CreateTestInput) => void;
  dispatchStartTest: (testId: string) => void;
  dispatchStopTest: (testId: string) => void;
  dispatchDeleteTest: (testId: string) => void;
  apiMode: boolean;
  engineInfo: { mode: string; engines: string[]; k8s: boolean } | null;
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
  apiMode: isGoBackendEnabled(),
  engineInfo: null,
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

  applyApiRefresh: (testsRes, runsRes) => {
    const tests = (testsRes.tests || []).map(mapApiTest);
    const runs = (runsRes.runs || []).map(mapApiRun);
    const liveMetrics = new Map(get().liveMetrics);
    // Drop metrics for tests no longer running
    for (const t of tests) {
      if (t.status !== "running") liveMetrics.delete(t.id);
    }
    set({ tests, runs, liveMetrics });
  },

  rehydrateFromApi: async () => {
    if (!isGoBackendEnabled()) return;
    try {
      const [testsRes, runsRes, slaRes, tmplRes, schedRes, execStatus] = await Promise.all([
        apiClient.getTests({ limit: 100 }),
        apiClient.getRuns({ limit: 100 }),
        apiClient.getSLAThresholds().catch(() => []),
        apiClient.getTemplates().catch(() => []),
        apiClient.getSchedules().catch(() => []),
        apiClient.getExecutionStatus().catch(() => null),
      ]);
      const tests = (testsRes.tests || []).map(mapApiTest);
      const runs = (runsRes.runs || []).map(mapApiRun);
      const liveMetrics = new Map<string, LiveMetrics>();
      tests
        .filter((t) => t.status === "running")
        .forEach((t) => {
          liveMetrics.set(t.id, createInitialMetrics(t.id, t.virtualUsers));
        });
      const slaList = Array.isArray(slaRes) ? slaRes.map(mapApiSLA) : [];
      const templates = Array.isArray(tmplRes) ? tmplRes.map(mapApiTemplate) : [];
      const schedules = Array.isArray(schedRes) ? schedRes.map(mapApiSchedule) : [];
      const now = new Date().toISOString();
      set({
        tests,
        runs,
        liveMetrics,
        trendData: get().trendData,
        slaThresholds: slaList.length > 0 ? slaList : get().slaThresholds,
        templates,
        schedules,
        infrastructure: [
          { component: "Controller", status: "healthy", lastChecked: now },
          {
            component: "Load Generator",
            status: execStatus?.k8s ? "healthy" : "degraded",
            lastChecked: now,
          },
          { component: "Database", status: "healthy", lastChecked: now },
        ],
        engineInfo: execStatus
          ? { mode: execStatus.mode, engines: execStatus.engines, k8s: execStatus.k8s }
          : get().engineInfo,
        hydrated: true,
        connected: true,
        apiMode: true,
      });
    } catch (err) {
      console.error("rehydrateFromApi failed:", err);
      throw err;
    }
  },

  hydrate: () => {
    if (get().hydrated) return;

    // Go control plane: load durable state from API
    if (isGoBackendEnabled()) {
      void get()
        .rehydrateFromApi()
        .catch((err) => {
          console.error("Failed to hydrate from API, falling back to mock:", err);
          const seed = createMockData();
          const liveMetrics = new Map<string, LiveMetrics>();
          seed.tests
            .filter((test) => test.status === "running")
            .forEach((test) => {
              liveMetrics.set(test.id, createInitialMetrics(test.id, test.virtualUsers));
            });
          set({ ...seed, liveMetrics, hydrated: true, apiMode: false, connected: false });
        });
      return;
    }

    const seed = createMockData();
    const liveMetrics = new Map<string, LiveMetrics>();
    seed.tests
      .filter((test) => test.status === "running")
      .forEach((test) => {
        liveMetrics.set(test.id, createInitialMetrics(test.id, test.virtualUsers));
      });

    set({ ...seed, liveMetrics, hydrated: true, apiMode: false });
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
    if (isGoBackendEnabled()) {
      void (async () => {
        try {
          const created = await apiClient.createTest({
            name: data.name,
            description: data.description,
            scriptType: data.scriptType,
            targetUrl: data.targetUrl,
            virtualUsers: data.virtualUsers,
          });
          const test = mapApiTest(created);
          set((state) => ({ tests: [...state.tests, test] }));
        } catch (err) {
          console.error("createTest API failed:", err);
        }
      })();
      return;
    }
    const { connected, sendMessage, createTest } = get();
    if (connected) {
      sendMessage({ type: "createTest", payload: data });
    } else {
      createTest(data);
    }
  },

  dispatchStartTest: (testId) => {
    if (isGoBackendEnabled()) {
      void (async () => {
        try {
          await apiClient.startTest(testId);
          set((state) => ({
            tests: state.tests.map((t) =>
              t.id === testId
                ? { ...t, status: "running" as const, lastRunAt: new Date().toISOString() }
                : t,
            ),
            liveMetrics: new Map(state.liveMetrics).set(
              testId,
              createInitialMetrics(
                testId,
                state.tests.find((t) => t.id === testId)?.virtualUsers ?? 10,
              ),
            ),
          }));
          // Refresh runs list
          const runsRes = await apiClient.getRuns({ limit: 100 });
          set({ runs: (runsRes.runs || []).map(mapApiRun) });
        } catch (err) {
          console.error("startTest API failed:", err);
        }
      })();
      return;
    }
    const { connected, sendMessage, startTest } = get();
    if (connected) {
      sendMessage({ type: "startTest", payload: { testId } });
    } else {
      startTest(testId);
    }
  },

  dispatchStopTest: (testId) => {
    if (isGoBackendEnabled()) {
      void (async () => {
        try {
          await apiClient.stopTest(testId);
          set((state) => {
            const nextMetrics = new Map(state.liveMetrics);
            nextMetrics.delete(testId);
            return {
              tests: state.tests.map((t) =>
                t.id === testId ? { ...t, status: "stopped" as const } : t,
              ),
              liveMetrics: nextMetrics,
            };
          });
          const runsRes = await apiClient.getRuns({ limit: 100 });
          set({ runs: (runsRes.runs || []).map(mapApiRun) });
        } catch (err) {
          console.error("stopTest API failed:", err);
        }
      })();
      return;
    }
    const { connected, sendMessage, stopTest } = get();
    if (connected) {
      sendMessage({ type: "stopTest", payload: { testId } });
    } else {
      stopTest(testId);
    }
  },

  dispatchDeleteTest: (testId) => {
    if (isGoBackendEnabled()) {
      void (async () => {
        try {
          await apiClient.deleteTest(testId);
          set((state) => {
            const nextMetrics = new Map(state.liveMetrics);
            nextMetrics.delete(testId);
            return {
              tests: state.tests.filter((t) => t.id !== testId),
              liveMetrics: nextMetrics,
            };
          });
        } catch (err) {
          console.error("deleteTest API failed:", err);
        }
      })();
      return;
    }
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
    if (isGoBackendEnabled()) {
      void (async () => {
        try {
          const metricMap: Record<string, string> = {
            avgResponseTime: "avg_response_time",
            errorRate: "error_rate",
            throughput: "throughput",
          };
          const condMap: Record<string, string> = {
            lessThan: "lte",
            greaterThan: "gte",
          };
          const created = await apiClient.createSLAThreshold({
            name: threshold.name,
            metric: metricMap[threshold.metric] || threshold.metric,
            condition: condMap[threshold.condition] || "lte",
            value: threshold.value,
          });
          set((state) => ({
            slaThresholds: [...state.slaThresholds, mapApiSLA(created)],
          }));
        } catch (err) {
          console.error("createSLA API failed:", err);
        }
      })();
      return;
    }
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
    if (isGoBackendEnabled()) {
      void (async () => {
        try {
          await apiClient.deleteSLAThreshold(id);
          set((state) => ({
            slaThresholds: state.slaThresholds.filter((t) => t.id !== id),
          }));
        } catch (err) {
          console.error("deleteSLA API failed:", err);
        }
      })();
      return;
    }
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
    if (isGoBackendEnabled()) {
      void (async () => {
        try {
          const created = await apiClient.createTemplate({
            name: template.name,
            description: template.description,
            scriptType: template.scriptType,
            targetUrl: template.targetUrl,
            virtualUsers: template.virtualUsers,
          });
          set((state) => ({
            templates: [...state.templates, mapApiTemplate(created)],
          }));
        } catch (err) {
          console.error("createTemplate API failed:", err);
        }
      })();
      return;
    }
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
    if (isGoBackendEnabled()) {
      void (async () => {
        try {
          await apiClient.deleteTemplate(id);
          set((state) => ({
            templates: state.templates.filter((t) => t.id !== id),
          }));
        } catch (err) {
          console.error("deleteTemplate API failed:", err);
        }
      })();
      return;
    }
    set((state) => ({
      templates: state.templates.filter((t) => t.id !== id),
    }));
  },

  createTestFromTemplate: (templateId) => {
    if (isGoBackendEnabled()) {
      void (async () => {
        try {
          const test = await apiClient.applyTemplate(templateId);
          set((state) => ({
            tests: [...state.tests, mapApiTest(test)],
            templates: state.templates.map((t) =>
              t.id === templateId ? { ...t, usageCount: t.usageCount + 1 } : t,
            ),
          }));
        } catch (err) {
          console.error("applyTemplate API failed:", err);
        }
      })();
      return;
    }
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
    if (isGoBackendEnabled()) {
      void (async () => {
        try {
          const created = await apiClient.createSchedule({
            testId: schedule.testId,
            name: schedule.testName || "Schedule",
            frequency: (schedule.frequency || "daily").toUpperCase(),
          });
          set((state) => ({
            schedules: [...state.schedules, mapApiSchedule(created)],
          }));
        } catch (err) {
          console.error("createSchedule API failed:", err);
        }
      })();
      return;
    }
    set((state) => ({
      schedules: [
        ...state.schedules,
        { ...schedule, id: newId("schedule"), createdAt: new Date().toISOString() },
      ],
    }));
  },

  updateSchedule: (id, updates) => {
    if (isGoBackendEnabled()) {
      void (async () => {
        try {
          const body: Record<string, unknown> = {};
          if (updates.enabled !== undefined) body.enabled = updates.enabled;
          if (updates.frequency) body.frequency = String(updates.frequency).toUpperCase();
          if (updates.testName) body.name = updates.testName;
          const updated = await apiClient.updateSchedule(id, body);
          set((state) => ({
            schedules: state.schedules.map((s) =>
              s.id === id ? mapApiSchedule(updated) : s,
            ),
          }));
        } catch (err) {
          console.error("updateSchedule API failed:", err);
        }
      })();
      return;
    }
    set((state) => ({
      schedules: state.schedules.map((s) =>
        s.id === id ? { ...s, ...updates } : s,
      ),
    }));
  },

  deleteSchedule: (id) => {
    if (isGoBackendEnabled()) {
      void (async () => {
        try {
          await apiClient.deleteSchedule(id);
          set((state) => ({
            schedules: state.schedules.filter((s) => s.id !== id),
          }));
        } catch (err) {
          console.error("deleteSchedule API failed:", err);
        }
      })();
      return;
    }
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
    const { dispatchStartTest, startTest } = get();
    testIds.forEach((id) => {
      if (isGoBackendEnabled()) {
        dispatchStartTest(id);
      } else {
        startTest(id);
      }
    });
  },

  bulkStopTests: (testIds) => {
    const { dispatchStopTest, stopTest } = get();
    testIds.forEach((id) => {
      if (isGoBackendEnabled()) {
        dispatchStopTest(id);
      } else {
        stopTest(id);
      }
    });
  },

  bulkDeleteTests: (testIds) => {
    const { dispatchDeleteTest, deleteTest } = get();
    testIds.forEach((id) => {
      if (isGoBackendEnabled()) {
        dispatchDeleteTest(id);
      } else {
        deleteTest(id);
      }
    });
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
