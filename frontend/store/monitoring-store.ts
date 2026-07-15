import { create } from "zustand";

import type {
  AppError,
  AuditEntry,
  HealthStatus,
  MonitoringState,
  PerformanceMetric,
  SystemHealth,
} from "@/types";

const ERRORS_KEY = "speedrunner-errors";
const AUDIT_KEY = "speedrunner-audit";

function getStoredErrors(): AppError[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(ERRORS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveErrors(errors: AppError[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ERRORS_KEY, JSON.stringify(errors.slice(0, 200)));
}

function getStoredAudit(): AuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(AUDIT_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveAudit(entries: AuditEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUDIT_KEY, JSON.stringify(entries.slice(0, 500)));
}

const defaultHealth: SystemHealth[] = [
  {
    id: "api",
    component: "API Server",
    status: "healthy",
    message: "All endpoints responding",
    lastChecked: new Date().toISOString(),
    metrics: { latency: 45, uptime: 99.9 },
  },
  {
    id: "database",
    component: "Database",
    status: "healthy",
    message: "Connection pool optimal",
    lastChecked: new Date().toISOString(),
    metrics: { connections: 12, queryTime: 15 },
  },
  {
    id: "cache",
    component: "Cache",
    status: "healthy",
    message: "Hit rate 95%",
    lastChecked: new Date().toISOString(),
    metrics: { hitRate: 95, memory: 45 },
  },
  {
    id: "websocket",
    component: "WebSocket",
    status: "healthy",
    message: "3 active connections",
    lastChecked: new Date().toISOString(),
    metrics: { connections: 3, messagesPerSec: 12 },
  },
];

export interface MonitoringStore extends MonitoringState {
  addPerformanceMetric: (metric: Omit<PerformanceMetric, "id" | "timestamp">) => void;
  clearPerformanceMetrics: () => void;

  addError: (error: Omit<AppError, "id" | "timestamp" | "resolved">) => void;
  resolveError: (id: string) => void;
  clearErrors: () => void;

  addAuditEntry: (entry: Omit<AuditEntry, "id" | "timestamp">) => void;
  clearAuditLog: () => void;

  updateHealth: (id: string, status: HealthStatus, message: string) => void;
  simulateHealthCheck: () => void;
}

export const useMonitoringStore = create<MonitoringStore>((set, get) => ({
  health: defaultHealth,
  performance: [],
  errors: getStoredErrors(),
  auditLog: getStoredAudit(),

  addPerformanceMetric: (metric) => {
    const newMetric: PerformanceMetric = {
      ...metric,
      id: `perf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    set((state) => ({
      performance: [...state.performance, newMetric].slice(-100),
    }));
  },

  clearPerformanceMetrics: () => {
    set({ performance: [] });
  },

  addError: (error) => {
    const newError: AppError = {
      ...error,
      id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      resolved: false,
    };
    const updated = [newError, ...get().errors].slice(0, 200);
    saveErrors(updated);
    set({ errors: updated });
  },

  resolveError: (id) => {
    const updated = get().errors.map((e) =>
      e.id === id ? { ...e, resolved: true } : e,
    );
    saveErrors(updated);
    set({ errors: updated });
  },

  clearErrors: () => {
    saveErrors([]);
    set({ errors: [] });
  },

  addAuditEntry: (entry) => {
    const newEntry: AuditEntry = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    const updated = [newEntry, ...get().auditLog].slice(0, 500);
    saveAudit(updated);
    set({ auditLog: updated });
  },

  clearAuditLog: () => {
    saveAudit([]);
    set({ auditLog: [] });
  },

  updateHealth: (id, status, message) => {
    set((state) => ({
      health: state.health.map((h) =>
        h.id === id
          ? { ...h, status, message, lastChecked: new Date().toISOString() }
          : h,
      ),
    }));
  },

  simulateHealthCheck: () => {
    const statuses: HealthStatus[] = ["healthy", "healthy", "healthy", "warning"];
    const messages = [
      "All systems operational",
      "Response time nominal",
      "No issues detected",
      "Slightly elevated latency",
    ];

    set((state) => ({
      health: state.health.map((h) => ({
        ...h,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        message: messages[Math.floor(Math.random() * messages.length)],
        lastChecked: new Date().toISOString(),
      })),
    }));
  },
}));

// Selector for critical alerts
export const selectCriticalAlerts = (state: MonitoringStore) =>
  state.errors.filter((e) => !e.resolved && e.severity === "critical");

// Selector for unresolved errors
export const selectUnresolvedErrors = (state: MonitoringStore) =>
  state.errors.filter((e) => !e.resolved);
