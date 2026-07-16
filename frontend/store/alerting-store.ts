import { create } from "zustand";

import type { AlertRule, AlertHistory } from "@/types";

const RULES_KEY = "speedrunner-alert-rules";
const HISTORY_KEY = "speedrunner-alert-history";

function getStored<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function save<T>(key: string, data: T[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(data));
}

const defaultRules: AlertRule[] = [
  {
    id: "rule-1",
    name: "High Response Time",
    metric: "avgResponseTime",
    condition: "above",
    threshold: 500,
    severity: "warning",
    channels: [{ type: "email", target: "admin@example.com", enabled: true }],
    enabled: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "rule-2",
    name: "High Error Rate",
    metric: "errorRate",
    condition: "above",
    threshold: 5,
    severity: "critical",
    channels: [{ type: "slack", target: "#alerts", enabled: true }],
    enabled: true,
    createdAt: new Date().toISOString(),
  },
];

export interface AlertingStore {
  rules: AlertRule[];
  history: AlertHistory[];
  createRule: (rule: Omit<AlertRule, "id" | "createdAt">) => AlertRule;
  updateRule: (id: string, updates: Partial<AlertRule>) => void;
  deleteRule: (id: string) => void;
  toggleRule: (id: string) => void;
  acknowledgeAlert: (id: string) => void;
  clearHistory: () => void;
}

export const useAlertingStore = create<AlertingStore>((set, get) => ({
  rules: getStored<AlertRule>(RULES_KEY).length > 0
    ? getStored<AlertRule>(RULES_KEY)
    : defaultRules,
  history: getStored<AlertHistory>(HISTORY_KEY),

  createRule: (rule) => {
    const newRule: AlertRule = {
      ...rule,
      id: `alert-rule-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [...get().rules, newRule];
    save(RULES_KEY, updated);
    set({ rules: updated });
    return newRule;
  },

  updateRule: (id, updates) => {
    const updated = get().rules.map((r) =>
      r.id === id ? { ...r, ...updates } : r,
    );
    save(RULES_KEY, updated);
    set({ rules: updated });
  },

  deleteRule: (id) => {
    const updated = get().rules.filter((r) => r.id !== id);
    save(RULES_KEY, updated);
    set({ rules: updated });
  },

  toggleRule: (id) => {
    const updated = get().rules.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r,
    );
    save(RULES_KEY, updated);
    set({ rules: updated });
  },

  acknowledgeAlert: (id) => {
    const updated = get().history.map((h) =>
      h.id === id ? { ...h, acknowledged: true } : h,
    );
    save(HISTORY_KEY, updated);
    set({ history: updated });
  },

  clearHistory: () => {
    save(HISTORY_KEY, []);
    set({ history: [] });
  },
}));
