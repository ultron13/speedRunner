import { beforeEach, describe, expect, it, vi } from "vitest";

import { useIntegrationStore } from "@/store/integration-store";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

vi.stubGlobal("localStorage", localStorageMock);

describe("integration store", () => {
  beforeEach(() => {
    localStorageMock.clear();
    useIntegrationStore.setState({
      apiKeys: [],
      webhooks: [],
      activityLog: [],
    });
  });

  it("generates and revokes API keys", () => {
    expect(useIntegrationStore.getState().apiKeys).toHaveLength(0);

    const key = useIntegrationStore.getState().generateAPIKey("Test Key", [
      { action: "read", resource: "tests" },
    ]);

    expect(useIntegrationStore.getState().apiKeys).toHaveLength(1);
    expect(key.name).toBe("Test Key");
    expect(key.key).toMatch(/^lr_/);
    expect(key.enabled).toBe(true);

    useIntegrationStore.getState().revokeAPIKey(key.id);
    expect(useIntegrationStore.getState().apiKeys).toHaveLength(0);
  });

  it("toggles API key enabled state", () => {
    const key = useIntegrationStore.getState().generateAPIKey("Test Key", [
      { action: "read", resource: "tests" },
    ]);

    expect(useIntegrationStore.getState().apiKeys[0].enabled).toBe(true);

    useIntegrationStore.getState().toggleAPIKey(key.id);
    expect(useIntegrationStore.getState().apiKeys[0].enabled).toBe(false);
  });

  it("creates and deletes webhooks", () => {
    expect(useIntegrationStore.getState().webhooks).toHaveLength(0);

    const webhook = useIntegrationStore.getState().createWebhook(
      "Slack",
      "https://hooks.slack.com/test",
      ["test.completed", "test.failed"],
    );

    expect(useIntegrationStore.getState().webhooks).toHaveLength(1);
    expect(webhook.name).toBe("Slack");
    expect(webhook.secret).toMatch(/^whsec_/);

    useIntegrationStore.getState().deleteWebhook(webhook.id);
    expect(useIntegrationStore.getState().webhooks).toHaveLength(0);
  });

  it("updates webhook", () => {
    const webhook = useIntegrationStore.getState().createWebhook(
      "Test",
      "https://test.com",
      ["test.completed"],
    );

    useIntegrationStore.getState().updateWebhook(webhook.id, { enabled: false });
    expect(useIntegrationStore.getState().webhooks[0].enabled).toBe(false);
  });

  it("manages integration status", () => {
    const integration = useIntegrationStore.getState().integrations[0];
    expect(integration.status).toBe("disconnected");

    useIntegrationStore.getState().connectIntegration(integration.id);
    expect(
      useIntegrationStore.getState().integrations.find((i) => i.id === integration.id)?.status,
    ).toBe("connected");

    useIntegrationStore.getState().disconnectIntegration(integration.id);
    expect(
      useIntegrationStore.getState().integrations.find((i) => i.id === integration.id)?.status,
    ).toBe("disconnected");
  });

  it("adds and clears activity log", () => {
    expect(useIntegrationStore.getState().activityLog).toHaveLength(0);

    useIntegrationStore.getState().addActivity({
      type: "key_generated",
      description: "Test activity",
    });

    expect(useIntegrationStore.getState().activityLog).toHaveLength(1);

    useIntegrationStore.getState().clearActivity();
    expect(useIntegrationStore.getState().activityLog).toHaveLength(0);
  });
});
