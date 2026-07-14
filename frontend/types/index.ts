export type TestStatus = "idle" | "running" | "completed" | "stopped" | "failed";
export type ScriptType = "HTTP" | "TruClient" | "JMeter";
export type RunStatus = "completed" | "stopped" | "failed";
export type InfrastructureState = "healthy" | "degraded" | "down";

export interface Test {
  id: string;
  name: string;
  description: string;
  scriptType: ScriptType;
  targetUrl: string;
  virtualUsers: number;
  status: TestStatus;
  createdAt: string;
  lastRunAt: string | null;
}

export interface Run {
  id: string;
  testId: string;
  testName: string;
  status: RunStatus;
  startedAt: string;
  completedAt: string;
  duration: number;
  throughput: number;
  avgResponseTime: number;
  errorRate: number;
}

export interface LiveMetrics {
  testId: string;
  duration: number;
  throughput: number;
  avgResponseTime: number;
  errorRate: number;
  timestamp: number;
}

export interface InfrastructureStatus {
  component: string;
  status: InfrastructureState;
  lastChecked: string;
}

export interface TrendPoint {
  timestamp: string;
  responseTime: number;
  throughput: number;
}

export interface CreateTestInput {
  name: string;
  description?: string;
  scriptType: ScriptType;
  targetUrl: string;
  virtualUsers: number;
}

export interface SeedData {
  tests: Test[];
  runs: Run[];
  trendData: TrendPoint[];
  infrastructure: InfrastructureStatus[];
}

export interface SLAThreshold {
  id: string;
  name: string;
  metric: "avgResponseTime" | "errorRate" | "throughput";
  condition: "lessThan" | "greaterThan";
  value: number;
  enabled: boolean;
}

export interface SLAViolation {
  thresholdId: string;
  runId: string;
  metric: string;
  expected: string;
  actual: string;
  timestamp: string;
}

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

export interface TestTemplate {
  id: string;
  name: string;
  description: string;
  scriptType: ScriptType;
  targetUrl: string;
  virtualUsers: number;
  createdAt: string;
  usageCount: number;
}

export interface PerformanceStats {
  totalRuns: number;
  avgResponseTime: number;
  p50ResponseTime: number;
  p90ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  avgThroughput: number;
  avgErrorRate: number;
  bestRun: Run | null;
  worstRun: Run | null;
  successRate: number;
}

export interface AlertNotification {
  id: string;
  type: "sla_violation" | "test_complete" | "test_failed";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export type UserRole = "admin" | "editor" | "viewer";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface CreateUserData {
  email: string;
  name: string;
  password: string;
  role: UserRole;
}

export interface Permission {
  action: "create" | "read" | "update" | "delete";
  resource: "tests" | "runs" | "templates" | "settings" | "users";
}

export type ScheduleFrequency = "once" | "hourly" | "daily" | "weekly" | "monthly";

export interface TestSchedule {
  id: string;
  testId: string;
  testName: string;
  frequency: ScheduleFrequency;
  nextRunAt: string;
  lastRunAt: string | null;
  enabled: boolean;
  createdAt: string;
  createdBy: string;
}

export interface TimelineEvent {
  id: string;
  testId: string;
  testName: string;
  type: "started" | "completed" | "failed" | "stopped" | "scheduled";
  timestamp: string;
  metadata?: {
    duration?: number;
    throughput?: number;
    avgResponseTime?: number;
    errorRate?: number;
  };
}

export type DashboardSection =
  | "summary"
  | "charts"
  | "activeTests"
  | "recentRuns"
  | "comparison"
  | "analytics"
  | "sla"
  | "templates"
  | "scheduler"
  | "timeline"
  | "profile"
  | "users"
  | "infrastructure";

export interface DashboardSectionConfig {
  id: DashboardSection;
  label: string;
  visible: boolean;
  collapsed: boolean;
}

export interface DashboardView {
  id: string;
  name: string;
  sections: DashboardSectionConfig[];
  createdAt: string;
  isDefault: boolean;
}

export interface RefreshConfig {
  enabled: boolean;
  intervalMs: number;
  lastRefreshedAt: string | null;
}

export interface APIKey {
  id: string;
  name: string;
  key: string;
  prefix: string;
  permissions: Permission[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  enabled: boolean;
}

export interface Webhook {
  id: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  enabled: boolean;
  createdAt: string;
  lastTriggeredAt: string | null;
  failureCount: number;
}

export type WebhookEvent =
  | "test.created"
  | "test.started"
  | "test.completed"
  | "test.failed"
  | "test.stopped"
  | "test.deleted"
  | "sla.violation"
  | "schedule.triggered";

export interface IntegrationStatus {
  id: string;
  name: string;
  type: "webhook" | "api" | "ci" | "notification";
  status: "connected" | "disconnected" | "error";
  lastChecked: string;
  metadata?: Record<string, string>;
}

export interface ActivityLogEntry {
  id: string;
  type: "api_call" | "webhook_triggered" | "key_generated" | "key_revoked" | "integration_connected" | "integration_disconnected";
  description: string;
  metadata?: Record<string, string>;
  timestamp: string;
  userId?: string;
}

export type ChartMetric = "avgResponseTime" | "throughput" | "errorRate" | "duration" | "virtualUsers";

export interface CustomChart {
  id: string;
  name: string;
  metric: ChartMetric;
  aggregation: "avg" | "min" | "max" | "sum" | "count";
  groupBy: "test" | "status" | "scriptType" | "day" | "hour";
  color: string;
  createdAt: string;
}

export interface ComparisonPeriod {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
}

export interface ComparisonResult {
  period1: {
    label: string;
    avgResponseTime: number;
    throughput: number;
    errorRate: number;
    totalRuns: number;
    successRate: number;
  };
  period2: {
    label: string;
    avgResponseTime: number;
    throughput: number;
    errorRate: number;
    totalRuns: number;
    successRate: number;
  };
  differences: {
    responseTime: number;
    throughput: number;
    errorRate: number;
    totalRuns: number;
    successRate: number;
  };
}

export interface GlobalFilters {
  dateRange: {
    start: string | null;
    end: string | null;
  };
  testIds: string[];
  statuses: RunStatus[];
  scriptTypes: ScriptType[];
}
