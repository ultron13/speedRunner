import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiClient } from "@/lib/api-client";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  apiClient.setToken(null);
});

describe("APIClient", () => {
  describe("request", () => {
    it("makes GET request with correct headers", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: "test" }),
      });

      await apiClient.request("/test");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/test",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });

    it("includes Authorization header when token is set", async () => {
      apiClient.setToken("test-token");
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: "test" }),
      });

      await apiClient.request("/test");

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/test",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        })
      );
    });

    it("throws error on non-OK response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Not found" }),
      });

      await expect(apiClient.request("/test")).rejects.toThrow("Not found");
    });

    it("sends POST request with body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "1" }),
      });

      await apiClient.request("/test", {
        method: "POST",
        body: { name: "test" },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/test",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "test" }),
        })
      );
    });
  });

  describe("Tests API", () => {
    it("getTests fetches tests list", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tests: [{ id: "1" }], total: 1 }),
      });

      const result = await apiClient.getTests();
      expect(result.tests).toHaveLength(1);
    });

    it("createTest sends POST request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "1", name: "Test" }),
      });

      const result = await apiClient.createTest({
        name: "Test",
        scriptType: "HTTP",
        targetUrl: "https://example.com",
        virtualUsers: 100,
      });

      expect(result.id).toBe("1");
    });

    it("startTest sends POST to start endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "run-1", status: "RUNNING" }),
      });

      const result = await apiClient.startTest("test-1", { duration: 60 });
      expect(result.status).toBe("RUNNING");
    });

    it("stopTest sends POST to stop endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await apiClient.stopTest("test-1");
      expect(result.success).toBe(true);
    });
  });

  describe("Runs API", () => {
    it("getRuns fetches runs list", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ runs: [{ id: "1" }], total: 1 }),
      });

      const result = await apiClient.getRuns();
      expect(result.runs).toHaveLength(1);
    });

    it("getRunMetrics fetches metrics for a run", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ timestamp: "2025-01-01", throughput: 100 }],
      });

      const result = await apiClient.getRunMetrics("run-1");
      expect(result).toHaveLength(1);
    });
  });

  describe("Auth API", () => {
    it("login sends credentials and returns token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: "jwt-token", user: { id: "1" } }),
      });

      const result = await apiClient.login("admin@test.com", "password");
      expect(result.token).toBe("jwt-token");
    });

    it("getMe fetches current user", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "1", name: "Admin" }),
      });

      const result = await apiClient.getMe();
      expect(result.name).toBe("Admin");
    });
  });

  describe("SLA API", () => {
    it("getSLAThresholds fetches thresholds", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "1", name: "RT SLA" }],
      });

      const result = await apiClient.getSLAThresholds();
      expect(result).toHaveLength(1);
    });

    it("createSLAThreshold sends POST request", async () => {
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
  });

  describe("Templates API", () => {
    it("getTemplates fetches templates", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "1", name: "Template" }],
      });

      const result = await apiClient.getTemplates();
      expect(result).toHaveLength(1);
    });

    it("createTemplate sends POST request", async () => {
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
  });

  describe("Audit API", () => {
    it("getAuditLogs fetches audit logs", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "1" }],
      });

      const result = await apiClient.getAuditLogs();
      expect(result).toHaveLength(1);
    });
  });
});
