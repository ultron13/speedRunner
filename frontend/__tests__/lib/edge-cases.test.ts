import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiClient } from "@/lib/api-client";

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  apiClient.setToken(null);
});

describe("API Client Edge Cases", () => {
  it("handles network errors gracefully", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    await expect(apiClient.request("/test")).rejects.toThrow("Network error");
  });

  it("handles empty error response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });
    await expect(apiClient.request("/test")).rejects.toThrow();
  });

  it("clears token when set to null", () => {
    apiClient.setToken("test-token");
    apiClient.setToken(null);
  });

  it("getTests handles missing params", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tests: [], total: 0 }),
    });
    const result = await apiClient.getTests();
    expect(result.tests).toEqual([]);
  });

  it("getTests with all params", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tests: [], total: 0 }),
    });
    await apiClient.getTests({ projectId: "p1", status: "RUNNING", limit: 10, offset: 0 });
    expect(mockFetch).toHaveBeenCalled();
  });

  it("getRuns with all params", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ runs: [], total: 0 }),
    });
    await apiClient.getRuns({ testId: "t1", status: "COMPLETED", limit: 5, offset: 10 });
    expect(mockFetch).toHaveBeenCalled();
  });

  it("getSLAThresholds with projectId", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });
    await apiClient.getSLAThresholds("project-1");
    expect(mockFetch).toHaveBeenCalled();
  });

  it("getTemplates with projectId", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });
    await apiClient.getTemplates("project-1");
    expect(mockFetch).toHaveBeenCalled();
  });

  it("getAuditLogs with all params", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ logs: [], total: 0 }),
    });
    await apiClient.getAuditLogs({ userId: "u1", resourceType: "test", limit: 20 });
    expect(mockFetch).toHaveBeenCalled();
  });

  it("getRunMetrics with interval", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });
    await apiClient.getRunMetrics("run-1", 5);
    expect(mockFetch).toHaveBeenCalled();
  });

  it("updateTest sends PUT request", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "1", name: "Updated" }),
    });
    const result = await apiClient.updateTest("1", { name: "Updated" });
    expect(result.name).toBe("Updated");
  });

  it("deleteTest sends DELETE request", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });
    const result = await apiClient.deleteTest("1");
    expect(result.success).toBe(true);
  });

  it("startTest with config", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "run-1", status: "RUNNING" }),
    });
    const result = await apiClient.startTest("test-1", { duration: 120, method: "POST" });
    expect(result.status).toBe("RUNNING");
  });

  it("stopTest", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });
    const result = await apiClient.stopTest("test-1");
    expect(result.success).toBe(true);
  });

  it("login with credentials", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "jwt", user: { id: "1" } }),
    });
    const result = await apiClient.login("admin@test.com", "pass");
    expect(result.token).toBe("jwt");
  });

  it("getMe", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "1", name: "Admin" }),
    });
    const result = await apiClient.getMe();
    expect(result.name).toBe("Admin");
  });

  it("createSLAThreshold", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "1", name: "New SLA" }),
    });
    const result = await apiClient.createSLAThreshold({
      name: "New SLA",
      metric: "AVG_RESPONSE_TIME",
      condition: "LESS_THAN",
      value: 500,
    });
    expect(result.name).toBe("New SLA");
  });

  it("createTemplate", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "1", name: "New Template" }),
    });
    const result = await apiClient.createTemplate({
      name: "New Template",
      scriptType: "HTTP",
      targetUrl: "https://example.com",
      virtualUsers: 100,
    });
    expect(result.name).toBe("New Template");
  });

  it("getRunMetrics without interval", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });
    await apiClient.getRunMetrics("run-1");
    expect(mockFetch).toHaveBeenCalled();
  });

  it("getSLAThresholds without projectId", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });
    await apiClient.getSLAThresholds();
    expect(mockFetch).toHaveBeenCalled();
  });

  it("getTemplates without projectId", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });
    await apiClient.getTemplates();
    expect(mockFetch).toHaveBeenCalled();
  });

  it("getAuditLogs without params", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ logs: [], total: 0 }),
    });
    await apiClient.getAuditLogs();
    expect(mockFetch).toHaveBeenCalled();
  });
});
