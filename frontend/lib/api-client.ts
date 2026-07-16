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

  async getLiveRunMetric(id: string) {
    return this.request<{
      runId: string;
      testId?: string;
      engine?: string;
      duration: number;
      throughput: number;
      avgResponseTime: number;
      errorRate: number;
      activeVUsers?: number;
      p50?: number;
      p90?: number;
      p95?: number;
      p99?: number;
      source?: string;
    }>(`/runs/${id}/live`);
  }

  async getLiveMetrics() {
    return this.request<{
      metrics: Array<{
        runId: string;
        testId: string;
        engine?: string;
        duration: number;
        throughput: number;
        avgResponseTime: number;
        errorRate: number;
        activeVUsers?: number;
      }>;
      active: number;
    }>("/runs/live");
  }

  async getExecutionStatus() {
    return this.request<{
      mode: string;
      engines: string[];
      k8s: boolean;
      active: number;
    }>("/execution/status");
  }

  async getExecutionJobs() {
    return this.request<{
      jobs: Array<Record<string, unknown>>;
      k8s: boolean;
      namespace?: string;
      total: number;
      message?: string;
    }>("/execution/jobs");
  }

  // Dashboard aggregates
  async getDashboardSummary() {
    return this.request<{
      totalTests: number;
      runningTests: number;
      completedRuns: number;
      failedRuns: number;
      avgResponseTime: number;
      avgThroughput: number;
      avgErrorRate: number;
      poolCapacity: number;
      poolUsed: number;
      openSlaBreaches: number;
      scheduledJobs: number;
    }>("/dashboard/summary");
  }

  // Environments
  async getEnvironments(projectId?: string) {
    const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    return this.request<Array<Record<string, unknown>>>(`/environments${q}`);
  }

  async createEnvironment(data: {
    name: string;
    baseUrl: string;
    region?: string;
    projectId?: string;
  }) {
    return this.request<Record<string, unknown>>("/environments", {
      method: "POST",
      body: data,
    });
  }

  async deleteEnvironment(id: string) {
    return this.request<{ success: boolean }>(`/environments/${id}`, {
      method: "DELETE",
    });
  }

  // Load generator pools
  async getPools() {
    return this.request<Array<Record<string, unknown>>>("/pools");
  }

  async createPool(data: {
    name: string;
    region?: string;
    engine?: string;
    capacityVUs?: number;
    namespace?: string;
  }) {
    return this.request<Record<string, unknown>>("/pools", {
      method: "POST",
      body: data,
    });
  }

  // Applications
  async getApplications(projectId?: string) {
    const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    return this.request<Array<Record<string, unknown>>>(`/applications${q}`);
  }

  async createApplication(data: {
    name: string;
    description?: string;
    owner?: string;
    projectId?: string;
  }) {
    return this.request<Record<string, unknown>>("/applications", {
      method: "POST",
      body: data,
    });
  }

  // Reports
  async getReports() {
    return this.request<Array<Record<string, unknown>>>("/reports");
  }

  async createReport(data: {
    name: string;
    runId?: string;
    projectId?: string;
    reportType?: string;
    summary?: string;
    payload?: Record<string, unknown>;
  }) {
    return this.request<Record<string, unknown>>("/reports", {
      method: "POST",
      body: data,
    });
  }

  async getReport(id: string) {
    return this.request<Record<string, unknown>>(`/reports/${id}`);
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
  async getSchedules(testId?: string) {
    const query = testId ? `?testId=${encodeURIComponent(testId)}` : "";
    return this.request<Array<Record<string, unknown>>>(`/schedules${query}`);
  }

  async createSchedule(data: {
    testId: string;
    name: string;
    frequency: string;
    cronExpression?: string;
  }) {
    return this.request<Record<string, unknown>>("/schedules", { method: "POST", body: data });
  }

  async updateSchedule(
    id: string,
    data: { name?: string; frequency?: string; cronExpression?: string; enabled?: boolean },
  ) {
    return this.request<Record<string, unknown>>(`/schedules/${id}`, { method: "PUT", body: data });
  }

  async deleteSchedule(id: string) {
    return this.request<{ success: boolean }>(`/schedules/${id}`, { method: "DELETE" });
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

  async deleteSLAThreshold(id: string) {
    return this.request<{ success: boolean }>(`/sla/thresholds/${id}`, { method: "DELETE" });
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

  async applyTemplate(id: string) {
    return this.request<Record<string, unknown>>(`/templates/${id}/apply`, { method: "POST" });
  }

  async deleteTemplate(id: string) {
    return this.request<{ success: boolean }>(`/templates/${id}`, { method: "DELETE" });
  }

  // API Keys
  async getAPIKeys() {
    return this.request<Array<Record<string, unknown>>>("/api-keys");
  }

  async createAPIKey(data: { name: string; expiresInDays?: number }) {
    return this.request<Record<string, unknown>>("/api-keys", { method: "POST", body: data });
  }

  async deleteAPIKey(id: string) {
    return this.request<{ success: boolean }>(`/api-keys/${id}`, { method: "DELETE" });
  }

  // Webhooks
  async getWebhooks() {
    return this.request<Array<Record<string, unknown>>>("/webhooks");
  }

  async createWebhook(data: { name: string; url: string; secret?: string; events?: string[] }) {
    return this.request<Record<string, unknown>>("/webhooks", { method: "POST", body: data });
  }

  async deleteWebhook(id: string) {
    return this.request<{ success: boolean }>(`/webhooks/${id}`, { method: "DELETE" });
  }

  // Cost estimation
  async estimateCost(data: {
    virtualUsers: number;
    durationSec: number;
    engine?: string;
    networkGb?: number;
    artifactGb?: number;
  }) {
    return this.request<Record<string, unknown>>("/cost/estimate", { method: "POST", body: data });
  }

  // AI assistants
  async recommendLoadProfile(data: { goal: string; peakRps?: number }) {
    return this.request<Record<string, unknown>>("/ai/recommend", { method: "POST", body: data });
  }

  async detectAnomaly(data: {
    metric: string;
    history: Array<{ timestamp: number; value: number }>;
    current: number;
  }) {
    return this.request<{ anomaly: boolean; finding?: Record<string, unknown> }>("/ai/anomaly", {
      method: "POST",
      body: data,
    });
  }

  // Regions
  async getRegions() {
    return this.request<Array<Record<string, unknown>>>("/regions");
  }

  // OpenAPI
  async getOpenAPI() {
    return this.request<Record<string, unknown>>("/openapi.json");
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
