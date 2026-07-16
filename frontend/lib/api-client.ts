/**
 * API client for SpeedRunner.
 *
 * Modes:
 * 1. Go control plane when NEXT_PUBLIC_API_URL is set (e.g. http://localhost:8080)
 * 2. Next.js /api routes when unset (legacy / standalone)
 */

const GO_BACKEND_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

function apiRoot(): string {
  return GO_BACKEND_URL ? `${GO_BACKEND_URL}/api` : "/api";
}

export function isGoBackendEnabled(): boolean {
  return Boolean(GO_BACKEND_URL);
}

class APIClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, headers = {} } = options;
    const normalized = path.startsWith("/") ? path : `/${path}`;
    const url = `${apiRoot()}${normalized}`;

    const response = await fetch(url, {
      method,
      headers: {
        ...this.getHeaders(),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Request failed" }));
      throw new Error((error as { error?: string }).error || `HTTP ${response.status}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // Tests
  async getTests(params?: {
    projectId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.projectId) searchParams.set("projectId", params.projectId);
    if (params?.status) searchParams.set("status", params.status);
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());

    const query = searchParams.toString();
    return this.request<{ tests: Array<Record<string, unknown>>; total: number }>(
      `/tests${query ? `?${query}` : ""}`,
    );
  }

  async getTest(id: string) {
    return this.request<Record<string, unknown>>(`/tests/${id}`);
  }

  async createTest(data: {
    name: string;
    description?: string;
    scriptType: string;
    targetUrl: string;
    virtualUsers: number;
    projectId?: string;
  }) {
    return this.request<Record<string, unknown>>("/tests", { method: "POST", body: data });
  }

  async updateTest(id: string, data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(`/tests/${id}`, { method: "PUT", body: data });
  }

  async deleteTest(id: string) {
    return this.request<{ success: boolean }>(`/tests/${id}`, { method: "DELETE" });
  }

  async startTest(
    id: string,
    config?: { duration?: number; rampUpDuration?: number; thinkTime?: number; method?: string },
  ) {
    return this.request<Record<string, unknown>>(`/tests/${id}/start`, {
      method: "POST",
      body: config ?? {},
    });
  }

  async stopTest(id: string) {
    return this.request<{ success: boolean }>(`/tests/${id}/stop`, { method: "POST" });
  }

  // Runs
  async getRuns(params?: {
    testId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.testId) searchParams.set("testId", params.testId);
    if (params?.status) searchParams.set("status", params.status);
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.offset) searchParams.set("offset", params.offset.toString());

    const query = searchParams.toString();
    return this.request<{ runs: Array<Record<string, unknown>>; total: number }>(
      `/runs${query ? `?${query}` : ""}`,
    );
  }

  async getRun(id: string) {
    return this.request<Record<string, unknown>>(`/runs/${id}`);
  }

  async createRun(data: { testId: string; triggerType?: string }) {
    return this.request<Record<string, unknown>>("/runs", { method: "POST", body: data });
  }

  async stopRun(id: string) {
    return this.request<{ success: boolean }>(`/runs/${id}/stop`, { method: "POST" });
  }

  async getRunMetrics(id: string, interval?: number) {
    const query = interval ? `?interval=${interval}` : "";
    return this.request<Array<Record<string, unknown>>>(`/runs/${id}/metrics${query}`);
  }

  // Auth
  async login(email: string, password: string) {
    return this.request<{ token: string; user: Record<string, unknown> }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
  }

  async register(data: { email: string; name: string; password: string; role?: string }) {
    return this.request<Record<string, unknown>>("/auth/register", {
      method: "POST",
      body: data,
    });
  }

  async getMe() {
    return this.request<Record<string, unknown>>("/auth/me");
  }

  // Projects
  async getProjects() {
    return this.request<Array<Record<string, unknown>>>("/projects");
  }

  async createProject(data: { name: string; description?: string }) {
    return this.request<Record<string, unknown>>("/projects", { method: "POST", body: data });
  }

  // Schedules
  async getSchedules() {
    return this.request<Array<Record<string, unknown>>>("/schedules");
  }

  async createSchedule(data: {
    testId: string;
    name: string;
    frequency: string;
    cronExpression?: string;
  }) {
    return this.request<Record<string, unknown>>("/schedules", { method: "POST", body: data });
  }

  // SLA
  async getSLAThresholds(projectId?: string) {
    const query = projectId ? `?projectId=${projectId}` : "";
    return this.request<Array<Record<string, unknown>>>(`/sla/thresholds${query}`);
  }

  async createSLAThreshold(data: {
    name: string;
    metric: string;
    condition: string;
    value: number;
    projectId?: string;
  }) {
    return this.request<Record<string, unknown>>("/sla/thresholds", { method: "POST", body: data });
  }

  async getSLAResults(runId?: string) {
    const query = runId ? `?runId=${runId}` : "";
    return this.request<Array<Record<string, unknown>>>(`/sla/results${query}`);
  }

  // Templates
  async getTemplates(projectId?: string) {
    const query = projectId ? `?projectId=${projectId}` : "";
    return this.request<Array<Record<string, unknown>>>(`/templates${query}`);
  }

  async createTemplate(data: {
    name: string;
    description?: string;
    scriptType: string;
    targetUrl: string;
    virtualUsers: number;
    projectId?: string;
  }) {
    return this.request<Record<string, unknown>>("/templates", { method: "POST", body: data });
  }

  // Audit
  async getAuditLogs(params?: { userId?: string; resourceType?: string; limit?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.userId) searchParams.set("userId", params.userId);
    if (params?.resourceType) searchParams.set("resourceType", params.resourceType);
    if (params?.limit) searchParams.set("limit", params.limit.toString());

    const query = searchParams.toString();
    return this.request<Array<Record<string, unknown>>>(`/audit${query ? `?${query}` : ""}`);
  }

  // Health (Go exposes /health outside /api)
  async healthCheck() {
    if (GO_BACKEND_URL) {
      const response = await fetch(`${GO_BACKEND_URL}/health`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<{ status: string; service: string; version: string }>;
    }
    return this.request<{ status: string; service: string; version: string }>("/health");
  }
}

export const apiClient = new APIClient();
