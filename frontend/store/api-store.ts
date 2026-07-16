import { create } from "zustand";

import type { APIEndpoint, APIIntegration, APIState } from "@/types";

const ENDPOINTS_KEY = "speedrunner-api-endpoints";
const INTEGRATIONS_KEY = "speedrunner-api-integrations";

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

const defaultEndpoints: APIEndpoint[] = [
  {
    id: "ep-1",
    method: "GET",
    path: "/api/tests",
    description: "Get all tests",
    parameters: [],
    responseExample: '{"tests": [...]}',
    tags: ["tests", "read"],
  },
  {
    id: "ep-2",
    method: "POST",
    path: "/api/tests",
    description: "Create a new test",
    parameters: [
      { name: "name", type: "string", required: true, description: "Test name" },
      { name: "targetUrl", type: "string", required: true, description: "Target URL" },
    ],
    responseExample: '{"test": {...}}',
    tags: ["tests", "create"],
  },
  {
    id: "ep-3",
    method: "GET",
    path: "/api/runs",
    description: "Get all test runs",
    parameters: [],
    responseExample: '{"runs": [...]}',
    tags: ["runs", "read"],
  },
];

const defaultIntegrations: APIIntegration[] = [
  {
    id: "int-1",
    name: "GitHub Actions",
    description: "Integrate with GitHub Actions for CI/CD",
    baseUrl: "https://api.github.com",
    status: "disconnected",
    lastSync: null,
    createdAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "int-2",
    name: "Slack",
    description: "Send notifications to Slack channels",
    baseUrl: "https://hooks.slack.com",
    status: "disconnected",
    lastSync: null,
    createdAt: "2025-01-01T00:00:00Z",
  },
];

export interface APIStore extends APIState {
  addEndpoint: (endpoint: Omit<APIEndpoint, "id">) => APIEndpoint;
  updateEndpoint: (id: string, updates: Partial<APIEndpoint>) => void;
  deleteEndpoint: (id: string) => void;

  addIntegration: (integration: Omit<APIIntegration, "id" | "createdAt">) => APIIntegration;
  updateIntegration: (id: string, updates: Partial<APIIntegration>) => void;
  deleteIntegration: (id: string) => void;
  connectIntegration: (id: string) => void;
  disconnectIntegration: (id: string) => void;
}

export const useAPIStore = create<APIStore>((set, get) => ({
  endpoints: getStored<APIEndpoint>(ENDPOINTS_KEY).length > 0
    ? getStored<APIEndpoint>(ENDPOINTS_KEY)
    : defaultEndpoints,
  integrations: getStored<APIIntegration>(INTEGRATIONS_KEY).length > 0
    ? getStored<APIIntegration>(INTEGRATIONS_KEY)
    : defaultIntegrations,

  addEndpoint: (endpoint) => {
    const newEndpoint: APIEndpoint = {
      ...endpoint,
      id: `ep-${Date.now()}`,
    };
    const updated = [...get().endpoints, newEndpoint];
    save(ENDPOINTS_KEY, updated);
    set({ endpoints: updated });
    return newEndpoint;
  },

  updateEndpoint: (id, updates) => {
    const updated = get().endpoints.map((e) =>
      e.id === id ? { ...e, ...updates } : e,
    );
    save(ENDPOINTS_KEY, updated);
    set({ endpoints: updated });
  },

  deleteEndpoint: (id) => {
    const updated = get().endpoints.filter((e) => e.id !== id);
    save(ENDPOINTS_KEY, updated);
    set({ endpoints: updated });
  },

  addIntegration: (integration) => {
    const newIntegration: APIIntegration = {
      ...integration,
      id: `int-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [...get().integrations, newIntegration];
    save(INTEGRATIONS_KEY, updated);
    set({ integrations: updated });
    return newIntegration;
  },

  updateIntegration: (id, updates) => {
    const updated = get().integrations.map((i) =>
      i.id === id ? { ...i, ...updates } : i,
    );
    save(INTEGRATIONS_KEY, updated);
    set({ integrations: updated });
  },

  deleteIntegration: (id) => {
    const updated = get().integrations.filter((i) => i.id !== id);
    save(INTEGRATIONS_KEY, updated);
    set({ integrations: updated });
  },

  connectIntegration: (id) => {
    const updated = get().integrations.map((i) =>
      i.id === id ? { ...i, status: "connected" as const, lastSync: new Date().toISOString() } : i,
    );
    save(INTEGRATIONS_KEY, updated);
    set({ integrations: updated });
  },

  disconnectIntegration: (id) => {
    const updated = get().integrations.map((i) =>
      i.id === id ? { ...i, status: "disconnected" as const } : i,
    );
    save(INTEGRATIONS_KEY, updated);
    set({ integrations: updated });
  },
}));
