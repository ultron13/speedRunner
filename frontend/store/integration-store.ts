import { create } from "zustand";

import type {
  APIKey,
  ActivityLogEntry,
  IntegrationStatus,
  Permission,
  Webhook,
  WebhookEvent,
} from "@/types";

const API_KEYS_KEY = "speedrunner-api-keys";
const WEBHOOKS_KEY = "speedrunner-webhooks";
const ACTIVITY_KEY = "speedrunner-activity";

function getStoredAPIKeys(): APIKey[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(API_KEYS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveAPIKeys(keys: APIKey[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(API_KEYS_KEY, JSON.stringify(keys));
}

function getStoredWebhooks(): Webhook[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(WEBHOOKS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveWebhooks(webhooks: Webhook[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(WEBHOOKS_KEY, JSON.stringify(webhooks));
}

function getStoredActivity(): ActivityLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(ACTIVITY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveActivity(entries: ActivityLogEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(entries.slice(0, 200)));
}

function generateAPIKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "lr_";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateSecret(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "whsec_";
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const defaultIntegrations: IntegrationStatus[] = [
  { id: "int-1", name: "GitHub Actions", type: "ci", status: "disconnected", lastChecked: new Date().toISOString() },
  { id: "int-2", name: "Slack Notifications", type: "notification", status: "disconnected", lastChecked: new Date().toISOString() },
  { id: "int-3", name: "Datadog APM", type: "api", status: "disconnected", lastChecked: new Date().toISOString() },
  { id: "int-4", name: "PagerDuty Alerts", type: "notification", status: "disconnected", lastChecked: new Date().toISOString() },
];

export interface IntegrationStore {
  apiKeys: APIKey[];
  webhooks: Webhook[];
  integrations: IntegrationStatus[];
  activityLog: ActivityLogEntry[];

  generateAPIKey: (name: string, permissions: Permission[], expiresAt?: string) => APIKey;
  revokeAPIKey: (id: string) => void;
  toggleAPIKey: (id: string) => void;

  createWebhook: (name: string, url: string, events: WebhookEvent[]) => Webhook;
  updateWebhook: (id: string, updates: Partial<Webhook>) => void;
  deleteWebhook: (id: string) => void;
  testWebhook: (id: string) => Promise<boolean>;

  updateIntegrationStatus: (id: string, status: IntegrationStatus["status"]) => void;
  connectIntegration: (id: string) => void;
  disconnectIntegration: (id: string) => void;

  addActivity: (entry: Omit<ActivityLogEntry, "id" | "timestamp">) => void;
  clearActivity: () => void;
}

export const useIntegrationStore = create<IntegrationStore>((set, get) => ({
  apiKeys: getStoredAPIKeys(),
  webhooks: getStoredWebhooks(),
  integrations: defaultIntegrations,
  activityLog: getStoredActivity(),

  generateAPIKey: (name, permissions, expiresAt) => {
    const key = generateAPIKey();
    const newAPIKey: APIKey = {
      id: `key-${Date.now()}`,
      name,
      key,
      prefix: key.slice(0, 7),
      permissions,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      expiresAt: expiresAt ?? null,
      enabled: true,
    };

    const updatedKeys = [...get().apiKeys, newAPIKey];
    saveAPIKeys(updatedKeys);
    set({ apiKeys: updatedKeys });

    get().addActivity({
      type: "key_generated",
      description: `API key "${name}" generated`,
      metadata: { keyPrefix: newAPIKey.prefix },
    });

    return newAPIKey;
  },

  revokeAPIKey: (id) => {
    const key = get().apiKeys.find((k) => k.id === id);
    const updatedKeys = get().apiKeys.filter((k) => k.id !== id);
    saveAPIKeys(updatedKeys);
    set({ apiKeys: updatedKeys });

    if (key) {
      get().addActivity({
        type: "key_revoked",
        description: `API key "${key.name}" revoked`,
        metadata: { keyPrefix: key.prefix },
      });
    }
  },

  toggleAPIKey: (id) => {
    const updatedKeys = get().apiKeys.map((k) =>
      k.id === id ? { ...k, enabled: !k.enabled } : k,
    );
    saveAPIKeys(updatedKeys);
    set({ apiKeys: updatedKeys });
  },

  createWebhook: (name, url, events) => {
    const newWebhook: Webhook = {
      id: `wh-${Date.now()}`,
      name,
      url,
      events,
      secret: generateSecret(),
      enabled: true,
      createdAt: new Date().toISOString(),
      lastTriggeredAt: null,
      failureCount: 0,
    };

    const updatedWebhooks = [...get().webhooks, newWebhook];
    saveWebhooks(updatedWebhooks);
    set({ webhooks: updatedWebhooks });

    get().addActivity({
      type: "webhook_triggered",
      description: `Webhook "${name}" created for ${events.length} event(s)`,
      metadata: { url },
    });

    return newWebhook;
  },

  updateWebhook: (id, updates) => {
    const updatedWebhooks = get().webhooks.map((w) =>
      w.id === id ? { ...w, ...updates } : w,
    );
    saveWebhooks(updatedWebhooks);
    set({ webhooks: updatedWebhooks });
  },

  deleteWebhook: (id) => {
    const webhook = get().webhooks.find((w) => w.id === id);
    const updatedWebhooks = get().webhooks.filter((w) => w.id !== id);
    saveWebhooks(updatedWebhooks);
    set({ webhooks: updatedWebhooks });

    if (webhook) {
      get().addActivity({
        type: "webhook_triggered",
        description: `Webhook "${webhook.name}" deleted`,
      });
    }
  },

  testWebhook: async (id) => {
    const webhook = get().webhooks.find((w) => w.id === id);
    if (!webhook) return false;

    // Simulate webhook test
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const success = Math.random() > 0.2; // 80% success rate

    if (!success) {
      get().updateWebhook(id, { failureCount: (webhook.failureCount || 0) + 1 });
    } else {
      get().updateWebhook(id, { lastTriggeredAt: new Date().toISOString() });
    }

    get().addActivity({
      type: "webhook_triggered",
      description: `Webhook "${webhook.name}" test ${success ? "succeeded" : "failed"}`,
      metadata: { url: webhook.url, result: success ? "success" : "failure" },
    });

    return success;
  },

  updateIntegrationStatus: (id, status) => {
    set((state) => ({
      integrations: state.integrations.map((i) =>
        i.id === id ? { ...i, status, lastChecked: new Date().toISOString() } : i,
      ),
    }));
  },

  connectIntegration: (id) => {
    const integration = get().integrations.find((i) => i.id === id);
    if (integration) {
      get().updateIntegrationStatus(id, "connected");
      get().addActivity({
        type: "integration_connected",
        description: `${integration.name} connected`,
      });
    }
  },

  disconnectIntegration: (id) => {
    const integration = get().integrations.find((i) => i.id === id);
    if (integration) {
      get().updateIntegrationStatus(id, "disconnected");
      get().addActivity({
        type: "integration_disconnected",
        description: `${integration.name} disconnected`,
      });
    }
  },

  addActivity: (entry) => {
    const newEntry: ActivityLogEntry = {
      ...entry,
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    const updated = [newEntry, ...get().activityLog].slice(0, 200);
    saveActivity(updated);
    set({ activityLog: updated });
  },

  clearActivity: () => {
    saveActivity([]);
    set({ activityLog: [] });
  },
}));
