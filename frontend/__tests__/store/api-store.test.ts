import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAPIStore } from "@/store/api-store";

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

describe("api store", () => {
  beforeEach(() => {
    localStorageMock.clear();
    useAPIStore.setState({
      endpoints: [],
      integrations: [],
    });
  });

  it("adds API endpoints", () => {
    const endpoint = useAPIStore.getState().addEndpoint({
      method: "GET",
      path: "/api/users",
      description: "Get all users",
      parameters: [],
      responseExample: '{"users": []}',
      tags: ["users"],
    });

    expect(useAPIStore.getState().endpoints).toHaveLength(1);
    expect(endpoint.method).toBe("GET");
    expect(endpoint.path).toBe("/api/users");
  });

  it("updates API endpoints", () => {
    const endpoint = useAPIStore.getState().addEndpoint({
      method: "GET",
      path: "/api/users",
      description: "Get all users",
      parameters: [],
      responseExample: "{}",
      tags: [],
    });

    useAPIStore.getState().updateEndpoint(endpoint.id, {
      description: "Updated description",
    });

    expect(useAPIStore.getState().endpoints[0].description).toBe("Updated description");
  });

  it("deletes API endpoints", () => {
    const endpoint = useAPIStore.getState().addEndpoint({
      method: "GET",
      path: "/api/users",
      description: "Get all users",
      parameters: [],
      responseExample: "{}",
      tags: [],
    });

    useAPIStore.getState().deleteEndpoint(endpoint.id);
    expect(useAPIStore.getState().endpoints).toHaveLength(0);
  });

  it("adds API integrations", () => {
    const integration = useAPIStore.getState().addIntegration({
      name: "GitHub",
      description: "GitHub integration",
      baseUrl: "https://api.github.com",
      status: "disconnected",
      lastSync: null,
    });

    expect(useAPIStore.getState().integrations).toHaveLength(1);
    expect(integration.name).toBe("GitHub");
  });

  it("connects and disconnects integrations", () => {
    const integration = useAPIStore.getState().addIntegration({
      name: "Slack",
      description: "Slack integration",
      baseUrl: "https://hooks.slack.com",
      status: "disconnected",
      lastSync: null,
    });

    useAPIStore.getState().connectIntegration(integration.id);
    expect(useAPIStore.getState().integrations[0].status).toBe("connected");
    expect(useAPIStore.getState().integrations[0].lastSync).not.toBeNull();

    useAPIStore.getState().disconnectIntegration(integration.id);
    expect(useAPIStore.getState().integrations[0].status).toBe("disconnected");
  });

  it("deletes integrations", () => {
    const integration = useAPIStore.getState().addIntegration({
      name: "Test Integration",
      description: "Test",
      baseUrl: "https://test.com",
      status: "disconnected",
      lastSync: null,
    });

    useAPIStore.getState().deleteIntegration(integration.id);
    expect(useAPIStore.getState().integrations).toHaveLength(0);
  });
});
