import { create } from "zustand";

import type {
  AutomationRule,
  CICDPipeline,
  CICDState,
  Deployment,
} from "@/types";

const PIPELINES_KEY = "speedrunner-pipelines";
const RULES_KEY = "speedrunner-automation-rules";
const DEPLOYMENTS_KEY = "speedrunner-deployments";

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

const defaultPipelines: CICDPipeline[] = [
  {
    id: "pipe-1",
    name: "Production Deploy",
    description: "Full deployment pipeline for production",
    stages: [
      { id: "s1", name: "Build", type: "build", config: {}, order: 1, enabled: true },
      { id: "s2", name: "Unit Tests", type: "test", config: {}, order: 2, enabled: true },
      { id: "s3", name: "Load Test", type: "test", config: {}, order: 3, enabled: true },
      { id: "s4", name: "Approve", type: "approve", config: {}, order: 4, enabled: true },
      { id: "s5", name: "Deploy", type: "deploy", config: {}, order: 5, enabled: true },
      { id: "s6", name: "Notify Team", type: "notify", config: {}, order: 6, enabled: true },
    ],
    trigger: "manual",
    enabled: true,
    lastRun: new Date(Date.now() - 86400000).toISOString(),
    createdAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "pipe-2",
    name: "Staging Validation",
    description: "Validate changes in staging environment",
    stages: [
      { id: "s1", name: "Build", type: "build", config: {}, order: 1, enabled: true },
      { id: "s2", name: "Run Tests", type: "test", config: {}, order: 2, enabled: true },
      { id: "s3", name: "Deploy to Staging", type: "deploy", config: {}, order: 3, enabled: true },
    ],
    trigger: "push",
    enabled: true,
    lastRun: new Date(Date.now() - 3600000).toISOString(),
    createdAt: "2025-01-01T00:00:00Z",
  },
];

const defaultRules: AutomationRule[] = [
  {
    id: "rule-1",
    name: "Auto-run on deployment",
    description: "Automatically run load tests when a deployment completes",
    trigger: "deployment",
    conditions: [
      { field: "environment", operator: "equals", value: "production" },
    ],
    actions: [
      { type: "run_test", config: { testId: "load-test-1" } },
      { type: "send_notification", config: { channel: "slack" } },
    ],
    enabled: true,
    lastTriggered: new Date(Date.now() - 86400000).toISOString(),
    createdAt: "2025-01-01T00:00:00Z",
  },
];

const defaultDeployments: Deployment[] = [
  {
    id: "dep-1",
    version: "v2.4.1",
    environment: "production",
    status: "completed",
    startedAt: new Date(Date.now() - 86400000).toISOString(),
    completedAt: new Date(Date.now() - 82800000).toISOString(),
    deployedBy: "Admin User",
    changes: ["Fixed response time regression", "Updated load balancer config"],
    metrics: { responseTime: 180, errorRate: 0.2, throughput: 450 },
  },
  {
    id: "dep-2",
    version: "v2.4.0",
    environment: "staging",
    status: "completed",
    startedAt: new Date(Date.now() - 172800000).toISOString(),
    completedAt: new Date(Date.now() - 169200000).toISOString(),
    deployedBy: "Admin User",
    changes: ["New caching layer", "Database optimization"],
    metrics: { responseTime: 195, errorRate: 0.1, throughput: 420 },
  },
];

export interface CICDStore extends CICDState {
  createPipeline: (pipeline: Omit<CICDPipeline, "id" | "createdAt">) => CICDPipeline;
  updatePipeline: (id: string, updates: Partial<CICDPipeline>) => void;
  deletePipeline: (id: string) => void;
  runPipeline: (id: string) => void;

  createAutomationRule: (rule: Omit<AutomationRule, "id" | "createdAt">) => AutomationRule;
  updateAutomationRule: (id: string, updates: Partial<AutomationRule>) => void;
  deleteAutomationRule: (id: string) => void;
  toggleAutomationRule: (id: string) => void;

  addDeployment: (deployment: Omit<Deployment, "id">) => Deployment;
  updateDeployment: (id: string, updates: Partial<Deployment>) => void;
}

export const useCICDStore = create<CICDStore>((set, get) => ({
  pipelines: getStored<CICDPipeline>(PIPELINES_KEY).length > 0
    ? getStored<CICDPipeline>(PIPELINES_KEY)
    : defaultPipelines,
  automationRules: getStored<AutomationRule>(RULES_KEY).length > 0
    ? getStored<AutomationRule>(RULES_KEY)
    : defaultRules,
  deployments: getStored<Deployment>(DEPLOYMENTS_KEY).length > 0
    ? getStored<Deployment>(DEPLOYMENTS_KEY)
    : defaultDeployments,

  createPipeline: (pipeline) => {
    const newPipeline: CICDPipeline = {
      ...pipeline,
      id: `pipe-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [...get().pipelines, newPipeline];
    save(PIPELINES_KEY, updated);
    set({ pipelines: updated });
    return newPipeline;
  },

  updatePipeline: (id, updates) => {
    const updated = get().pipelines.map((p) =>
      p.id === id ? { ...p, ...updates } : p,
    );
    save(PIPELINES_KEY, updated);
    set({ pipelines: updated });
  },

  deletePipeline: (id) => {
    const updated = get().pipelines.filter((p) => p.id !== id);
    save(PIPELINES_KEY, updated);
    set({ pipelines: updated });
  },

  runPipeline: (id) => {
    const updated = get().pipelines.map((p) =>
      p.id === id ? { ...p, lastRun: new Date().toISOString() } : p,
    );
    save(PIPELINES_KEY, updated);
    set({ pipelines: updated });
  },

  createAutomationRule: (rule) => {
    const newRule: AutomationRule = {
      ...rule,
      id: `rule-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [...get().automationRules, newRule];
    save(RULES_KEY, updated);
    set({ automationRules: updated });
    return newRule;
  },

  updateAutomationRule: (id, updates) => {
    const updated = get().automationRules.map((r) =>
      r.id === id ? { ...r, ...updates } : r,
    );
    save(RULES_KEY, updated);
    set({ automationRules: updated });
  },

  deleteAutomationRule: (id) => {
    const updated = get().automationRules.filter((r) => r.id !== id);
    save(RULES_KEY, updated);
    set({ automationRules: updated });
  },

  toggleAutomationRule: (id) => {
    const updated = get().automationRules.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r,
    );
    save(RULES_KEY, updated);
    set({ automationRules: updated });
  },

  addDeployment: (deployment) => {
    const newDeployment: Deployment = {
      ...deployment,
      id: `dep-${Date.now()}`,
    };
    const updated = [newDeployment, ...get().deployments].slice(0, 50);
    save(DEPLOYMENTS_KEY, updated);
    set({ deployments: updated });
    return newDeployment;
  },

  updateDeployment: (id, updates) => {
    const updated = get().deployments.map((d) =>
      d.id === id ? { ...d, ...updates } : d,
    );
    save(DEPLOYMENTS_KEY, updated);
    set({ deployments: updated });
  },
}));