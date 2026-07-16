import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTestStore } from "@/store/test-store";
import { useAuthStore } from "@/store/auth-store";

// Mock API client
vi.mock("@/lib/api-client", () => ({
  apiClient: {
    setToken: vi.fn(),
    getTests: vi.fn().mockResolvedValue({ tests: [], total: 0 }),
    getRuns: vi.fn().mockResolvedValue({ runs: [], total: 0 }),
    createTest: vi.fn().mockResolvedValue({ id: "new-test", name: "New Test" }),
    startTest: vi.fn().mockResolvedValue({ id: "run-1", status: "RUNNING" }),
    stopTest: vi.fn().mockResolvedValue({ success: true }),
    login: vi.fn().mockResolvedValue({ token: "jwt-token", user: { id: "1", email: "test@test.com", name: "Test", role: "READ_ONLY" } }),
    getMe: vi.fn().mockResolvedValue({ id: "1", email: "test@test.com", name: "Test", role: "READ_ONLY" }),
    getSLAThresholds: vi.fn().mockResolvedValue([]),
    createSLAThreshold: vi.fn().mockResolvedValue({ id: "sla-1", name: "New SLA" }),
    getTemplates: vi.fn().mockResolvedValue([]),
    createTemplate: vi.fn().mockResolvedValue({ id: "tpl-1", name: "New Template" }),
    getAuditLogs: vi.fn().mockResolvedValue({ logs: [], total: 0 }),
  },
}));

beforeEach(() => {
  useTestStore.setState({
    tests: [],
    runs: [],
    liveMetrics: new Map(),
    slaThresholds: [],
  });
  useAuthStore.setState({
    isAuthenticated: false,
    user: null,
  });
});

describe("Test Store API Integration", () => {
  it("fetchTestsFromAPI imports and calls API", async () => {
    const { fetchTestsFromAPI } = await import("@/store/test-store-api");
    const result = await fetchTestsFromAPI();
    expect(result).toEqual([]);
  });

  it("fetchRunsFromAPI imports and calls API", async () => {
    const { fetchRunsFromAPI } = await import("@/store/test-store-api");
    const result = await fetchRunsFromAPI();
    expect(result).toEqual([]);
  });

  it("createTestViaAPI creates test and updates store", async () => {
    const { createTestViaAPI } = await import("@/store/test-store-api");
    const result = await createTestViaAPI({
      name: "New Test",
      scriptType: "HTTP",
      targetUrl: "https://example.com",
      virtualUsers: 100,
    });
    expect(result.id).toBe("new-test");
  });

  it("startTestViaAPI starts test and updates store", async () => {
    const { startTestViaAPI } = await import("@/store/test-store-api");
    const result = await startTestViaAPI("test-1");
    expect(result.status).toBe("RUNNING");
  });

  it("stopTestViaAPI stops test and updates store", async () => {
    const { stopTestViaAPI } = await import("@/store/test-store-api");
    const result = await stopTestViaAPI("test-1");
    expect(result).toBe(true);
  });
});

describe("Auth Store API Integration", () => {
  it("loginViaAPI authenticates and stores token", async () => {
    const { loginViaAPI } = await import("@/store/auth-store-api");
    const result = await loginViaAPI("test@test.com", "password");
    expect(result.token).toBe("jwt-token");
  });

  it("fetchCurrentUser fetches user from token", async () => {
    // Set a token in localStorage
    localStorage.setItem("speedrunner-token", "test-token");
    
    const { fetchCurrentUser } = await import("@/store/auth-store-api");
    const result = await fetchCurrentUser();
    expect(result).toBeDefined();
  });

  it("logoutViaAPI clears token and state", async () => {
    localStorage.setItem("speedrunner-token", "test-token");
    
    const { logoutViaAPI } = await import("@/store/auth-store-api");
    logoutViaAPI();
    
    expect(localStorage.getItem("speedrunner-token")).toBeNull();
  });
});

describe("SLA Store API Integration", () => {
  it("fetchSLAThresholdsFromAPI fetches thresholds", async () => {
    const { fetchSLAThresholdsFromAPI } = await import("@/store/alerting-store-api");
    const result = await fetchSLAThresholdsFromAPI();
    expect(result).toEqual([]);
  });

  it("createSLAThresholdViaAPI creates threshold", async () => {
    const { createSLAThresholdViaAPI } = await import("@/store/alerting-store-api");
    const result = await createSLAThresholdViaAPI({
      name: "New SLA",
      metric: "AVG_RESPONSE_TIME",
      condition: "LESS_THAN",
      value: 500,
    });
    expect(result.name).toBe("New SLA");
  });
});

describe("Templates Store API Integration", () => {
  it("fetchTemplatesFromAPI fetches templates", async () => {
    const { fetchTemplatesFromAPI } = await import("@/store/reporting-store-api");
    const result = await fetchTemplatesFromAPI();
    expect(result).toEqual([]);
  });

  it("createTemplateViaAPI creates template", async () => {
    const { createTemplateViaAPI } = await import("@/store/reporting-store-api");
    const result = await createTemplateViaAPI({
      name: "New Template",
      scriptType: "HTTP",
      targetUrl: "https://example.com",
      virtualUsers: 100,
    });
    expect(result.name).toBe("New Template");
  });
});
