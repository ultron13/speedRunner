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

  // Phase 4.x APIs
  async getEngines() {
    return this.request<Array<Record<string, unknown>>>("/engines");
  }

  async getKedaRecommend() {
    return this.request<Record<string, unknown>>("/keda/recommend");
  }

  async multiAnomaly(series: Record<string, { history: Array<{ timestamp: number; value: number }>; current: number }>) {
    return this.request<{ anomalyCount: number; findings: Array<Record<string, unknown>> }>(
      "/ai/anomaly/multi",
      { method: "POST", body: { series } },
    );
  }

  async correlateBottlenecks(data: {
    runId?: string;
    errorRate?: number;
    avgResponseTime?: number;
    signals?: Array<Record<string, unknown>>;
  }) {
    return this.request<{ bottlenecks: Array<Record<string, unknown>> }>("/impact/correlate", {
      method: "POST",
      body: data,
    });
  }

  async exportTestGitOps(id: string, format: "yaml" | "json" = "json") {
    if (format === "yaml") {
      const root = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
      const base = root ? `${root}/api` : "/api";
      const res = await fetch(`${base}/gitops/tests/${id}?format=yaml`, {
        headers: this.getToken() ? { Authorization: `Bearer ${this.getToken()}` } : {},
      });
      return res.text();
    }
    return this.request<Record<string, unknown>>(`/gitops/tests/${id}?format=json`);
  }

  async importTestGitOps(manifest: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/gitops/tests/import", {
      method: "POST",
      body: manifest,
    });
  }

  async getDataPools() {
    return this.request<Array<Record<string, unknown>>>("/data-pools");
  }

  async createDataPool(data: {
    name: string;
    keyPrefix?: string;
    itemCount?: number;
    ttlSeconds?: number;
    masked?: boolean;
  }) {
    return this.request<Record<string, unknown>>("/data-pools", { method: "POST", body: data });
  }

  async preloadDataPool(id: string, count?: number) {
    return this.request<Record<string, unknown>>(`/data-pools/${id}/preload`, {
      method: "POST",
      body: { count },
    });
  }

  async costScheduleRecommend(data: {
    virtualUsers: number;
    durationSec: number;
    engine?: string;
    urgency?: string;
  }) {
    return this.request<Record<string, unknown>>("/cost/schedule-recommend", {
      method: "POST",
      body: data,
    });
  }

  async createOperatorRun(data: {
    name?: string;
    testId?: string;
    targetUrl: string;
    virtualUsers?: number;
    durationSec?: number;
    engine?: string;
  }) {
    return this.request<Record<string, unknown>>("/operator/runs", {
      method: "POST",
      body: data,
    });
  }

  async listOperatorRuns() {
    return this.request<Array<Record<string, unknown>>>("/operator/runs");
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

  // ── Phase 7 platform APIs ──────────────────────────────────────────────────
  async getFeatureFlags() {
    return this.request<Record<string, boolean>>("/platform/flags");
  }

  async setFeatureFlag(name: string, enabled: boolean) {
    return this.request<Record<string, boolean>>("/platform/flags", {
      method: "POST",
      body: { name, enabled },
    });
  }

  async getMaintenance() {
    return this.request<{ window: Record<string, unknown>; active: boolean }>("/platform/maintenance");
  }

  async setMaintenance(window: Record<string, unknown>) {
    return this.request<{ window: Record<string, unknown>; active: boolean }>("/platform/maintenance", {
      method: "POST",
      body: window,
    });
  }

  async getExecutionWindows() {
    return this.request<{
      windows: Array<Record<string, unknown>>;
      allowedNow: boolean;
      reason: string;
    }>("/platform/windows");
  }

  async getApprovals(status?: string) {
    const q = status ? `?status=${encodeURIComponent(status)}` : "";
    return this.request<Array<Record<string, unknown>>>(`/approvals${q}`);
  }

  async createApproval(data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/approvals", { method: "POST", body: data });
  }

  async decideApproval(id: string, data: { status: string; reason?: string }) {
    return this.request<Record<string, unknown>>(`/approvals/${id}/decide`, {
      method: "POST",
      body: data,
    });
  }

  async compareRuns(baseline: Record<string, unknown>, candidate: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/runs/compare", {
      method: "POST",
      body: { baseline, candidate },
    });
  }

  async aggregateTrends(points: Array<Record<string, unknown>>, bucketMinutes?: number) {
    return this.request<Record<string, unknown>>("/trends/aggregate", {
      method: "POST",
      body: { points, bucketMinutes },
    });
  }

  async getNotifications() {
    return this.request<Array<Record<string, unknown>>>("/notifications");
  }

  async publishNotification(data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/notifications", { method: "POST", body: data });
  }

  async getArtifacts(runId?: string) {
    const q = runId ? `?runId=${encodeURIComponent(runId)}` : "";
    return this.request<Array<Record<string, unknown>>>(`/artifacts${q}`);
  }

  async createArtifact(data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/artifacts", { method: "POST", body: data });
  }

  async securityUtils(data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/security/utils", { method: "POST", body: data });
  }

  async chargeback(lines?: Array<Record<string, unknown>>) {
    return this.request<Record<string, unknown>>("/chargeback", { method: "POST", body: lines ?? [] });
  }

  async getRetention() {
    return this.request<Record<string, unknown>>("/retention");
  }

  async getWorkloads() {
    return this.request<Array<Record<string, unknown>>>("/workloads");
  }

  async getJourneys() {
    return this.request<Array<Record<string, unknown>>>("/journeys");
  }

  async releaseBoard(items?: Array<Record<string, unknown>>) {
    return this.request<Record<string, unknown>>("/release-board", {
      method: "POST",
      body: items ?? [],
    });
  }

  async getHealthMatrix() {
    return this.request<Record<string, unknown>>("/health-matrix");
  }

  async getPlatformPhases(wave?: "7" | "8" | "all") {
    const q = wave ? `?wave=${wave}` : "";
    return this.request<{
      wave?: string;
      waves?: string[];
      count: number;
      phase7Count?: number;
      phase8Count?: number;
      phases: Array<{ id: string; name: string }>;
    }>(`/platform/phases${q}`);
  }

  // ── Phase 8 advanced ops APIs ──────────────────────────────────────────────
  async getOutbox() {
    return this.request<{ pending: Array<Record<string, unknown>> }>("/platform/outbox");
  }

  async enqueueOutbox(type: string, payload: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/platform/outbox", {
      method: "POST",
      body: { type, payload },
    });
  }

  async signWebhook(data: { secret: string; body: string; action?: "sign" | "verify"; signature?: string }) {
    return this.request<Record<string, unknown>>("/platform/webhooks/sign", {
      method: "POST",
      body: data,
    });
  }

  async checkIdempotency(key: string) {
    return this.request<{ key: string; first: boolean; duplicate: boolean }>("/platform/idempotency", {
      method: "POST",
      body: { key },
    });
  }

  async softDelete(id: string, action: "delete" | "restore" | "check" = "delete") {
    return this.request<{ id: string; deleted: boolean }>("/platform/soft-delete", {
      method: "POST",
      body: { id, action },
    });
  }

  async evaluateAlert(rule: Record<string, unknown>, value: number) {
    return this.request<{ fired: boolean; message: string }>("/alerts/evaluate", {
      method: "POST",
      body: { rule, value },
    });
  }

  async sloStatus(slo: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/slo/status", { method: "POST", body: slo });
  }

  async circuitBreaker(action: "allow" | "success" | "failure" | "state" = "state") {
    return this.request<Record<string, unknown>>("/platform/circuit", {
      method: "POST",
      body: { action },
    });
  }

  async watchdog(data: {
    durationSec: number;
    maxDurationSec: number;
    errorRate: number;
    maxErrorRate: number;
  }) {
    return this.request<{ shouldStop: boolean; reason: string }>("/platform/watchdog", {
      method: "POST",
      body: data,
    });
  }

  async getFairQueue() {
    return this.request<{ len: number }>("/platform/queue");
  }

  async fairQueueAction(data: { action: "enqueue" | "dequeue"; run?: Record<string, unknown> }) {
    return this.request<Record<string, unknown>>("/platform/queue", { method: "POST", body: data });
  }

  async progressiveRamp(data: {
    targetVUs: number;
    rampSec: number;
    steps: number;
    elapsedSec?: number;
  }) {
    return this.request<Record<string, unknown>>("/platform/ramp", { method: "POST", body: data });
  }

  async budgetStatus(budget: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/platform/budget", { method: "POST", body: budget });
  }

  async getUserPrefs() {
    return this.request<{ searches: Array<Record<string, unknown>>; bookmarks: Array<Record<string, unknown>> }>(
      "/platform/prefs",
    );
  }

  async saveUserPref(data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/platform/prefs", { method: "POST", body: data });
  }

  async classifyData(text: string) {
    return this.request<Record<string, unknown>>("/platform/classify", { method: "POST", body: { text } });
  }

  async compliancePack(runIds: string[], auditCount?: number) {
    return this.request<Record<string, unknown>>("/platform/compliance-pack", {
      method: "POST",
      body: { runIds, auditCount },
    });
  }

  async getOrg() {
    return this.request<{ units: Array<Record<string, unknown>>; invites: Array<Record<string, unknown>> }>(
      "/platform/org",
    );
  }

  async inviteOrg(invite: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/platform/org", { method: "POST", body: invite });
  }

  // ── Phase 9 resilience / observability APIs ────────────────────────────────
  async regionFailover(regions?: Array<Record<string, unknown>>) {
    return this.request<Record<string, unknown>>("/platform/regions/failover", {
      method: "POST",
      body: { regions: regions ?? [] },
    });
  }

  async evaluateDR(policy: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/platform/dr/evaluate", {
      method: "POST",
      body: policy,
    });
  }

  async sampleTrace(data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/platform/traces/sample", {
      method: "POST",
      body: data,
    });
  }

  async getSynthetics() {
    return this.request<Record<string, unknown>>("/platform/synthetics");
  }

  async upsertSynthetic(check: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/platform/synthetics", {
      method: "POST",
      body: check,
    });
  }

  async analyzeCanary(snapshot: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/platform/canary/analyze", {
      method: "POST",
      body: snapshot,
    });
  }

  async planCapacity(input: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/platform/capacity/plan", {
      method: "POST",
      body: input,
    });
  }

  async exportBundle(data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/platform/export-bundle", {
      method: "POST",
      body: data,
    });
  }

  async checkRollout(data: { feature: string; percent: number; userKey?: string }) {
    return this.request<Record<string, unknown>>("/platform/rollout", {
      method: "POST",
      body: data,
    });
  }

  // ── Phase 10 — OpenText EPE 25.3 parity ─────────────────────────────────────
  async aviator(data: {
    mode?: "script" | "analysis" | "chat";
    prompt?: string;
    context?: Record<string, unknown>;
  }) {
    return this.request<{
      mode: string;
      answer: string;
      actions?: string[];
      suggestions?: Array<Record<string, string>>;
      protocol?: string;
      summary?: string;
      anomalies?: Array<Record<string, unknown>>;
    }>("/aviator", { method: "POST", body: data });
  }

  async getSplunkMetrics(params?: { service?: string; metric?: string }) {
    const sp = new URLSearchParams();
    if (params?.service) sp.set("service", params.service);
    if (params?.metric) sp.set("metric", params.metric);
    const q = sp.toString();
    return this.request<{ integration: string; metrics: Array<Record<string, unknown>> }>(
      `/integrations/splunk${q ? `?${q}` : ""}`,
    );
  }

  async ingestSplunkMetric(metric: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/integrations/splunk", {
      method: "POST",
      body: metric,
    });
  }

  async getOTEL() {
    return this.request<{ config: Record<string, unknown>; recent: Array<Record<string, unknown>> }>(
      "/integrations/otel",
    );
  }

  async configureOTEL(config: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/integrations/otel", {
      method: "POST",
      body: { action: "configure", config },
    });
  }

  async exportOTELSpan(span: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/integrations/otel", {
      method: "POST",
      body: { action: "export", span },
    });
  }

  async getRunRuntime(runId: string) {
    return this.request<Record<string, unknown>>(`/runs/${runId}/runtime`);
  }

  async runRuntimeAction(
    runId: string,
    data: {
      action: "ensure" | "add" | "stop" | "rendezvous";
      vusers?: number;
      targetVUs?: number;
      rendezvousName?: string;
      rendezvousPolicy?: string;
      rendezvousPercent?: number;
    },
  ) {
    return this.request<Record<string, unknown>>(`/runs/${runId}/runtime`, {
      method: "POST",
      body: data,
    });
  }

  async getAWSTemplates() {
    return this.request<Array<Record<string, unknown>>>("/cloud/aws-templates");
  }

  async upsertAWSTemplate(template: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/cloud/aws-templates", {
      method: "POST",
      body: template,
    });
  }

  async getPasswordPolicy() {
    return this.request<{
      policy: Record<string, unknown>;
      mustChange: boolean;
      userId: string;
    }>("/security/password-policy");
  }

  async updatePasswordPolicy(data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/security/password-policy", {
      method: "POST",
      body: data,
    });
  }

  async resolveVaultScript(script: string, put?: Record<string, string>) {
    return this.request<{ resolved: string; missing: string[] }>("/integrations/vault/resolve", {
      method: "POST",
      body: { script, put },
    });
  }

  async getProtocols() {
    return this.request<{
      protocols: Array<Record<string, unknown>>;
      llmProfile: Record<string, unknown>;
    }>("/protocols");
  }

  async getEPE253Features() {
    return this.request<{
      release: string;
      video: string;
      features: Array<{ feature: string; api: string }>;
      phases: Array<{ id: string; name: string }>;
      count: number;
    }>("/platform/epe-25.3");
  }

  // ── Phase 11–13 SaaS / CI / edge ────────────────────────────────────────────
  async getTenants() {
    return this.request<Array<Record<string, unknown>>>("/tenants");
  }

  async upsertTenant(tenant: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/tenants", { method: "POST", body: tenant });
  }

  async validateLicense(data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/license/validate", { method: "POST", body: data });
  }

  async getMarketplace(params?: { kind?: string; tag?: string }) {
    const sp = new URLSearchParams();
    if (params?.kind) sp.set("kind", params.kind);
    if (params?.tag) sp.set("tag", params.tag);
    const q = sp.toString();
    return this.request<Array<Record<string, unknown>>>(`/marketplace${q ? `?${q}` : ""}`);
  }

  async marketplaceAction(data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/marketplace", { method: "POST", body: data });
  }

  async getAPITiers(plan?: string) {
    const q = plan ? `?plan=${encodeURIComponent(plan)}` : "";
    return this.request<Record<string, unknown>>(`/api-tiers${q}`);
  }

  async qualityGate(data: { rules?: Array<Record<string, unknown>>; metrics: Record<string, number> }) {
    return this.request<Record<string, unknown>>("/ci/quality-gate", { method: "POST", body: data });
  }

  async digitalTwin(input: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/capacity/digital-twin", {
      method: "POST",
      body: input,
    });
  }

  async getChaosScenarios() {
    return this.request<Record<string, unknown>>("/chaos/scenarios");
  }

  async startChaos(data: { scenarioId: string; env: string }) {
    return this.request<Record<string, unknown>>("/chaos/scenarios", { method: "POST", body: data });
  }

  async validateJourney(journey: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/journeys/validate", {
      method: "POST",
      body: journey,
    });
  }

  async checkPerfBudget(data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/ci/perf-budget", { method: "POST", body: data });
  }

  async getEdgeLocations() {
    return this.request<{ edges: Array<Record<string, unknown>>; mobile: Array<Record<string, unknown>> }>(
      "/edge/locations",
    );
  }

  async estimateFinOps(data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/finops/estimate", { method: "POST", body: data });
  }

  async getConnectors(category?: string) {
    const q = category ? `?category=${encodeURIComponent(category)}` : "";
    return this.request<Array<Record<string, unknown>>>(`/connectors${q}`);
  }

  async connectorAction(data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>("/connectors", { method: "POST", body: data });
  }
}

export const apiClient = new APIClient();
