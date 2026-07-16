import { create } from "zustand";

import type {
  DeploymentPipeline,
  DeploymentRecord,
  DeploymentState,
  Environment,
  RollbackConfig,
} from "@/types";

const ENV_KEY = "speedrunner-environments";
const PIPELINE_KEY = "speedrunner-deployment-pipelines";
const DEPLOYMENTS_KEY = "speedrunner-deployment-records";
const ROLLBACK_KEY = "speedrunner-rollbacks";

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

const defaultEnvironments: Environment[] = [
  { id: "env-1", name: "Development", type: "development", url: "https://dev.speedrunner.app", status: "active", version: "v2.5.0", lastDeployed: new Date(Date.now() - 3600000).toISOString(), deployedBy: "Admin User" },
  { id: "env-2", name: "Staging", type: "staging", url: "https://staging.speedrunner.app", status: "active", version: "v2.5.0", lastDeployed: new Date(Date.now() - 7200000).toISOString(), deployedBy: "Admin User" },
  { id: "env-3", name: "Production", type: "production", url: "https://speedrunner.app", status: "active", version: "v2.4.1", lastDeployed: new Date(Date.now() - 86400000).toISOString(), deployedBy: "Admin User" },
  { id: "env-4", name: "QA", type: "qa", url: "https://qa.speedrunner.app", status: "maintenance", version: "v2.5.0-beta", lastDeployed: new Date(Date.now() - 172800000).toISOString(), deployedBy: "Admin User" },
];

const defaultPipelines: DeploymentPipeline[] = [
  {
    id: "dp-1",
    name: "Standard Deployment",
    environments: ["dev-1", "staging-2", "prod-3"],
    stages: [
      { id: "s1", name: "Build", type: "build", status: "completed" },
      { id: "s2", name: "Unit Tests", type: "test", status: "completed" },
      { id: "s3", name: "Integration Tests", type: "test", status: "completed" },
      { id: "s4", name: "Deploy to Staging", type: "deploy", status: "completed" },
      { id: "s5", name: "Approval", type: "approve", status: "pending" },
      { id: "s6", name: "Deploy to Production", type: "deploy", status: "pending" },
      { id: "s7", name: "Notify Team", type: "notify", status: "pending" },
    ],
    trigger: "manual",
    enabled: true,
    createdAt: "2025-01-01T00:00:00Z",
  },
];

const defaultDeployments: DeploymentRecord[] = [
  {
    id: "dr-1",
    version: "v2.4.1",
    environment: "production",
    pipeline: "Standard Deployment",
    status: "completed",
    startedAt: new Date(Date.now() - 86400000).toISOString(),
    completedAt: new Date(Date.now() - 82800000).toISOString(),
    deployedBy: "Admin User",
    changes: ["Fixed response time regression", "Updated load balancer config", "Database optimization"],
    metrics: { responseTime: 180, errorRate: 0.2, throughput: 450, availability: 99.99 },
  },
  {
    id: "dr-2",
    version: "v2.4.0",
    environment: "staging",
    pipeline: "Standard Deployment",
    status: "completed",
    startedAt: new Date(Date.now() - 172800000).toISOString(),
    completedAt: new Date(Date.now() - 169200000).toISOString(),
    deployedBy: "Admin User",
    changes: ["New caching layer", "Database optimization"],
    metrics: { responseTime: 195, errorRate: 0.1, throughput: 420, availability: 99.98 },
  },
];

export interface DeploymentStore extends DeploymentState {
  addEnvironment: (env: Omit<Environment, "id">) => Environment;
  updateEnvironment: (id: string, updates: Partial<Environment>) => void;
  deleteEnvironment: (id: string) => void;

  createPipeline: (pipeline: Omit<DeploymentPipeline, "id" | "createdAt">) => DeploymentPipeline;
  updatePipeline: (id: string, updates: Partial<DeploymentPipeline>) => void;
  deletePipeline: (id: string) => void;
  runPipeline: (id: string) => void;

  addDeployment: (deployment: Omit<DeploymentRecord, "id">) => DeploymentRecord;
  updateDeployment: (id: string, updates: Partial<DeploymentRecord>) => void;
  rollbackDeployment: (deploymentId: string, targetVersion: string, reason: string) => RollbackConfig;
}

export const useDeploymentStore = create<DeploymentStore>((set, get) => ({
  environments: getStored<Environment>(ENV_KEY).length > 0
    ? getStored<Environment>(ENV_KEY)
    : defaultEnvironments,
  pipelines: getStored<DeploymentPipeline>(PIPELINE_KEY).length > 0
    ? getStored<DeploymentPipeline>(PIPELINE_KEY)
    : defaultPipelines,
  deployments: getStored<DeploymentRecord>(DEPLOYMENTS_KEY).length > 0
    ? getStored<DeploymentRecord>(DEPLOYMENTS_KEY)
    : defaultDeployments,
  rollbacks: getStored<RollbackConfig>(ROLLBACK_KEY),

  addEnvironment: (env) => {
    const newEnv: Environment = { ...env, id: `env-${Date.now()}` };
    const updated = [...get().environments, newEnv];
    save(ENV_KEY, updated);
    set({ environments: updated });
    return newEnv;
  },

  updateEnvironment: (id, updates) => {
    const updated = get().environments.map((e) =>
      e.id === id ? { ...e, ...updates } : e,
    );
    save(ENV_KEY, updated);
    set({ environments: updated });
  },

  deleteEnvironment: (id) => {
    const updated = get().environments.filter((e) => e.id !== id);
    save(ENV_KEY, updated);
    set({ environments: updated });
  },

  createPipeline: (pipeline) => {
    const newPipeline: DeploymentPipeline = {
      ...pipeline,
      id: `dp-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [...get().pipelines, newPipeline];
    save(PIPELINE_KEY, updated);
    set({ pipelines: updated });
    return newPipeline;
  },

  updatePipeline: (id, updates) => {
    const updated = get().pipelines.map((p) =>
      p.id === id ? { ...p, ...updates } : p,
    );
    save(PIPELINE_KEY, updated);
    set({ pipelines: updated });
  },

  deletePipeline: (id) => {
    const updated = get().pipelines.filter((p) => p.id !== id);
    save(PIPELINE_KEY, updated);
    set({ pipelines: updated });
  },

  runPipeline: (id) => {
    const pipeline = get().pipelines.find((p) => p.id === id);
    if (!pipeline) return;

    const updatedStages = pipeline.stages.map((stage, index) => ({
      ...stage,
      status: index === 0 ? "running" as const : "pending" as const,
      startedAt: index === 0 ? new Date().toISOString() : undefined,
    }));

    const updated = get().pipelines.map((p) =>
      p.id === id ? { ...p, stages: updatedStages } : p,
    );
    save(PIPELINE_KEY, updated);
    set({ pipelines: updated });
  },

  addDeployment: (deployment) => {
    const newDeployment: DeploymentRecord = {
      ...deployment,
      id: `dr-${Date.now()}`,
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

  rollbackDeployment: (deploymentId, targetVersion, reason) => {
    const rollback: RollbackConfig = {
      id: `rb-${Date.now()}`,
      deploymentId,
      targetVersion,
      reason,
      initiatedBy: "Current User",
      initiatedAt: new Date().toISOString(),
      status: "pending",
    };

    const updated = [...get().rollbacks, rollback];
    save(ROLLBACK_KEY, updated);
    set({ rollbacks: updated });

    // Update deployment status
    get().updateDeployment(deploymentId, { status: "rolled_back" });

    return rollback;
  },
}));
