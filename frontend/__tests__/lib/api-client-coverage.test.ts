import { describe, it, expect, vi, beforeEach } from "vitest";

describe("APIClient Coverage", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("handles request with all header options", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { apiClient } = await import("@/lib/api-client");
    apiClient.setToken("test-token-123");
    
    const result = await apiClient.request("/test", {
      method: "POST",
      body: { key: "value" },
      headers: { "X-Custom": "header" },
    });
    
    expect(result).toEqual({ success: true });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/test"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ key: "value" }),
      })
    );
  });

  it("handles request without body", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { apiClient } = await import("@/lib/api-client");
    apiClient.setToken(null);
    
    await apiClient.request("/test");
    
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/test"),
      expect.objectContaining({
        method: "GET",
        body: undefined,
      })
    );
  });

  it("handles error response with error field", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Not found" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { apiClient } = await import("@/lib/api-client");
    
    await expect(apiClient.request("/test")).rejects.toThrow("Not found");
  });

  it("handles error response without error field", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { apiClient } = await import("@/lib/api-client");
    
    await expect(apiClient.request("/test")).rejects.toThrow("HTTP");
  });

  it("handles json parse error in response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error("Invalid JSON")),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { apiClient } = await import("@/lib/api-client");
    
    await expect(apiClient.request("/test")).rejects.toThrow("Request failed");
  });

  it("getTests with all params", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ tests: [], total: 0 }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { apiClient } = await import("@/lib/api-client");
    
    await apiClient.getTests({ projectId: "p1", status: "RUNNING", limit: 10, offset: 0 });
    
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("projectId=p1"),
      expect.anything()
    );
  });

  it("getTests without params", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ tests: [], total: 0 }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { apiClient } = await import("@/lib/api-client");
    
    await apiClient.getTests();
    
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/tests"),
      expect.anything()
    );
  });

  it("getRuns with all params", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ runs: [], total: 0 }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { apiClient } = await import("@/lib/api-client");
    
    await apiClient.getRuns({ testId: "t1", status: "COMPLETED", limit: 5, offset: 10 });
    
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("testId=t1"),
      expect.anything()
    );
  });

  it("getRuns without params", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ runs: [], total: 0 }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { apiClient } = await import("@/lib/api-client");
    
    await apiClient.getRuns();
    
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/runs"),
      expect.anything()
    );
  });

  it("getAuditLogs with all params", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { apiClient } = await import("@/lib/api-client");
    
    await apiClient.getAuditLogs({ userId: "u1", resourceType: "test", limit: 20 });
    
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("userId=u1"),
      expect.anything()
    );
  });

  it("getAuditLogs without params", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { apiClient } = await import("@/lib/api-client");
    
    await apiClient.getAuditLogs();
    
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/audit"),
      expect.anything()
    );
  });

  it("getSLAResults with runId", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { apiClient } = await import("@/lib/api-client");
    
    await apiClient.getSLAResults("run-1");
    
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("runId=run-1"),
      expect.anything()
    );
  });

  it("getSLAResults without runId", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { apiClient } = await import("@/lib/api-client");
    
    await apiClient.getSLAResults();
    
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/sla/results"),
      expect.anything()
    );
  });

  it("healthCheck returns status", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "healthy", service: "backend", version: "1.0" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { apiClient } = await import("@/lib/api-client");
    
    const result = await apiClient.healthCheck();
    
    expect(result).toEqual({ status: "healthy", service: "backend", version: "1.0" });
  });
});
