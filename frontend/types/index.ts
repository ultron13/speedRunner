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

export type ExportFormat = "pdf" | "csv" | "json" | "html";

export interface ExportConfig {
  format: ExportFormat;
  sections: string[];
  dateRange?: { start: string; end: string };
  includeCharts: boolean;
  includeMetrics: boolean;
}

export interface ShareableLink {
  id: string;
  url: string;
  filters: GlobalFilters;
  createdAt: string;
  expiresAt: string | null;
  accessCount: number;
}

export interface EmailReport {
  id: string;
  to: string[];
  subject: string;
  body: string;
  attachmentFormat: ExportFormat;
  sentAt: string | null;
  status: "pending" | "sent" | "failed";
}

export interface ImportedData {
  tests?: CreateTestInput[];
  templates?: Omit<TestTemplate, "id" | "createdAt" | "usageCount">[];
  count: number;
  errors: string[];
}

export type SearchableEntityType = "test" | "run" | "template" | "schedule" | "user" | "webhook";

export interface SearchResult {
  id: string;
  entityType: SearchableEntityType;
  title: string;
  subtitle: string;
  matchField: string;
  matchSnippet: string;
  score: number;
}

export interface SearchFilters {
  entityTypes: SearchableEntityType[];
  dateRange?: { start: string; end: string };
  statuses?: string[];
}

export interface SavedFilter {
  id: string;
  name: string;
  filters: SearchFilters;
  createdAt: string;
  usageCount: number;
}

export interface SearchHistoryEntry {
  id: string;
  query: string;
  filters: SearchFilters;
  timestamp: string;
  resultCount: number;
}

export interface GlobalSearchState {
  query: string;
  filters: SearchFilters;
  results: SearchResult[];
  history: SearchHistoryEntry[];
  savedFilters: SavedFilter[];
  isSearching: boolean;
}

export type HealthStatus = "healthy" | "warning" | "critical" | "unknown";

export interface SystemHealth {
  id: string;
  component: string;
  status: HealthStatus;
  message: string;
  lastChecked: string;
  metrics?: Record<string, number>;
}

export interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  category: "render" | "network" | "memory" | "cpu";
}

export interface AppError {
  id: string;
  message: string;
  stack?: string;
  component?: string;
  timestamp: string;
  severity: "info" | "warning" | "error" | "critical";
  resolved: boolean;
}

export interface AuditEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  timestamp: string;
  ipAddress?: string;
}

export interface MonitoringState {
  health: SystemHealth[];
  performance: PerformanceMetric[];
  errors: AppError[];
  auditLog: AuditEntry[];
}

export interface TeamWorkspace {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  members: WorkspaceMember[];
  createdAt: string;
  updatedAt: string;
  isDefault: boolean;
}

export interface WorkspaceMember {
  userId: string;
  userName: string;
  role: "owner" | "admin" | "member" | "viewer";
  joinedAt: string;
}

export interface Comment {
  id: string;
  entityType: "test" | "run" | "template";
  entityId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
  updatedAt: string | null;
  replies: Comment[];
}

export interface UserActivity {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName: string;
  timestamp: string;
  metadata?: Record<string, string>;
}

export interface CollaborationState {
  workspaces: TeamWorkspace[];
  comments: Comment[];
  activities: UserActivity[];
  activeWorkspaceId: string | null;
}

export interface TestConfiguration {
  id: string;
  name: string;
  description: string;
  targetUrl: string;
  scriptType: ScriptType;
  virtualUsers: number;
  duration: number;
  rampUpTime: number;
  thinkTime: number;
  headers: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export type ChaosScenarioType = "network" | "latency" | "error" | "timeout" | "resource";

export interface ChaosScenario {
  id: string;
  name: string;
  description: string;
  type: ChaosScenarioType;
  config: {
    target: string;
    intensity: number;
    duration: number;
    probability: number;
  };
  enabled: boolean;
  createdAt: string;
}

export type LoadProfileType = "constant" | "ramp-up" | "ramp-down" | "spike" | "step" | "wave";

export interface LoadProfile {
  id: string;
  name: string;
  description: string;
  type: LoadProfileType;
  config: {
    startUsers: number;
    endUsers: number;
    duration: number;
    steps?: number;
    peakDuration?: number;
  };
  createdAt: string;
}

export interface AdvancedTestState {
  configurations: TestConfiguration[];
  chaosScenarios: ChaosScenario[];
  loadProfiles: LoadProfile[];
}

export interface OnlineUser {
  id: string;
  name: string;
  avatar?: string;
  status: "online" | "away" | "busy";
  lastSeen: string;
  currentPage?: string;
  cursor?: { x: number; y: number };
}

export interface RealTimeNotification {
  id: string;
  type: "mention" | "comment" | "update" | "alert" | "system";
  title: string;
  message: string;
  from?: string;
  link?: string;
  read: boolean;
  timestamp: string;
}

export interface Annotation {
  id: string;
  entityType: "test" | "run" | "chart" | "metric";
  entityId: string;
  content: string;
  color: string;
  position?: { x: number; y: number };
  userId: string;
  userName: string;
  createdAt: string;
  resolved: boolean;
}

export interface RealTimeState {
  onlineUsers: OnlineUser[];
  notifications: RealTimeNotification[];
  annotations: Annotation[];
  isConnected: boolean;
  lastPing: string | null;
}

export type AnomalySeverity = "low" | "medium" | "high" | "critical";

export interface Anomaly {
  id: string;
  metric: string;
  description: string;
  severity: AnomalySeverity;
  detectedAt: string;
  value: number;
  expectedRange: { min: number; max: number };
  resolved: boolean;
}

export interface Prediction {
  id: string;
  metric: string;
  currentValue: number;
  predictedValue: number;
  confidence: number;
  timeframe: string;
  trend: "increasing" | "decreasing" | "stable";
  generatedAt: string;
}

export type RecommendationPriority = "low" | "medium" | "high";

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: RecommendationPriority;
  category: "performance" | "reliability" | "cost" | "security";
  impact: string;
  effort: string;
  createdAt: string;
  applied: boolean;
}

export interface AIInsight {
  id: string;
  type: "anomaly" | "prediction" | "recommendation" | "summary";
  title: string;
  content: string;
  confidence: number;
  generatedAt: string;
}

export interface AIAnalyticsState {
  anomalies: Anomaly[];
  predictions: Prediction[];
  recommendations: Recommendation[];
  insights: AIInsight[];
}

export type ChartType = "line" | "bar" | "area" | "scatter" | "heatmap" | "pie" | "radar";

export interface AdvancedChart {
  id: string;
  name: string;
  type: ChartType;
  dataSource: string;
  metrics: string[];
  groupBy?: string;
  filters?: Record<string, unknown>;
  colors: string[];
  createdAt: string;
}

export type ReportTemplateType = "executive" | "technical" | "comparison" | "trend" | "custom";

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  type: ReportTemplateType;
  sections: ReportSection[];
  createdAt: string;
  usageCount: number;
}

export interface ReportSection {
  id: string;
  title: string;
  type: "chart" | "table" | "summary" | "metrics";
  config: Record<string, unknown>;
}

export interface ScheduledReport {
  id: string;
  name: string;
  templateId: string;
  frequency: "daily" | "weekly" | "monthly";
  recipients: string[];
  lastGenerated: string | null;
  nextGeneration: string;
  enabled: boolean;
  createdAt: string;
}

export interface AdvancedReportingState {
  charts: AdvancedChart[];
  templates: ReportTemplate[];
  scheduledReports: ScheduledReport[];
}

export interface TwoFactorAuth {
  enabled: boolean;
  secret: string;
  backupCodes: string[];
  lastVerified: string | null;
}

export interface UserSession {
  id: string;
  userId: string;
  device: string;
  browser: string;
  ipAddress: string;
  location: string;
  lastActive: string;
  createdAt: string;
  isCurrent: boolean;
}

export interface ComplianceRequirement {
  id: string;
  name: string;
  description: string;
  category: "data" | "access" | "audit" | "encryption";
  status: "compliant" | "non-compliant" | "pending";
  lastChecked: string;
  details?: string;
}

export interface SecurityAlert {
  id: string;
  type: "login" | "password" | "api" | "data" | "compliance";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  timestamp: string;
  resolved: boolean;
  userId?: string;
}

export interface SecurityState {
  twoFactorAuth: TwoFactorAuth;
  sessions: UserSession[];
  compliance: ComplianceRequirement[];
  securityAlerts: SecurityAlert[];
}

export type PipelineStageType = "build" | "test" | "deploy" | "notify" | "approve";

export interface PipelineStage {
  id: string;
  name: string;
  type: PipelineStageType;
  config: Record<string, unknown>;
  order: number;
  enabled: boolean;
}

export interface CICDPipeline {
  id: string;
  name: string;
  description: string;
  stages: PipelineStage[];
  trigger: "manual" | "push" | "schedule" | "webhook";
  enabled: boolean;
  lastRun: string | null;
  createdAt: string;
}

export type AutomationTrigger = "test_completed" | "deployment" | "schedule" | "manual" | "webhook";

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: AutomationTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  enabled: boolean;
  lastTriggered: string | null;
  createdAt: string;
}

export interface AutomationCondition {
  field: string;
  operator: "equals" | "contains" | "greaterThan" | "lessThan";
  value: string;
}

export interface AutomationAction {
  type: "run_test" | "send_notification" | "update_status" | "create_ticket";
  config: Record<string, unknown>;
}

export interface Deployment {
  id: string;
  version: string;
  environment: "development" | "staging" | "production";
  status: "pending" | "in_progress" | "completed" | "failed" | "rolled_back";
  startedAt: string;
  completedAt: string | null;
  deployedBy: string;
  changes: string[];
  metrics?: {
    responseTime: number;
    errorRate: number;
    throughput: number;
  };
}

export interface CICDState {
  pipelines: CICDPipeline[];
  automationRules: AutomationRule[];
  deployments: Deployment[];
}

export type DataExportFormat = "csv" | "json" | "pdf" | "html" | "xml";

export interface DataExportConfig {
  id: string;
  name: string;
  format: DataExportFormat;
  dataSource: string;
  filters?: Record<string, unknown>;
  transform?: DataTransform;
  createdAt: string;
}

export interface DataTransform {
  type: "filter" | "sort" | "aggregate" | "rename" | "calculate";
  config: Record<string, unknown>;
}

export interface DataImportConfig {
  id: string;
  name: string;
  format: "csv" | "json" | "xml";
  dataSource: string;
  mapping?: Record<string, string>;
  validation?: DataValidation;
  createdAt: string;
}

export interface DataValidation {
  required: string[];
  unique: string[];
  patterns: Record<string, string>;
}

export interface ScheduledExport {
  id: string;
  name: string;
  exportConfigId: string;
  frequency: "daily" | "weekly" | "monthly";
  destination: string;
  lastExported: string | null;
  nextExport: string;
  enabled: boolean;
  createdAt: string;
}

export interface DataUtilitiesState {
  exports: DataExportConfig[];
  imports: DataImportConfig[];
  scheduledExports: ScheduledExport[];
}

export interface BenchmarkConfig {
  id: string;
  name: string;
  description: string;
  testIds: string[];
  metrics: string[];
  iterations: number;
  createdAt: string;
}

export interface BenchmarkResult {
  id: string;
  configId: string;
  testName: string;
  metrics: Record<string, { avg: number; min: number; max: number; p95: number }>;
  completedAt: string;
}

export interface BenchmarkState {
  configs: BenchmarkConfig[];
  results: BenchmarkResult[];
}

export interface APIEndpoint {
  id: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  description: string;
  parameters: APIParameter[];
  responseExample: string;
  tags: string[];
}

export interface APIParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface APIIntegration {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
  apiKey?: string;
  status: "connected" | "disconnected" | "error";
  lastSync: string | null;
  createdAt: string;
}

export interface APIState {
  endpoints: APIEndpoint[];
  integrations: APIIntegration[];
}

// Phase 34: Advanced Alerting
export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: "above" | "below" | "equals";
  threshold: number;
  severity: "info" | "warning" | "critical";
  channels: AlertChannel[];
  enabled: boolean;
  createdAt: string;
}

export interface AlertChannel {
  type: "email" | "slack" | "webhook" | "sms";
  target: string;
  enabled: boolean;
}

export interface AlertHistory {
  id: string;
  ruleId: string;
  message: string;
  severity: string;
  triggeredAt: string;
  acknowledged: boolean;
}

// Phase 35: Team Collaboration
export interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "editor" | "viewer";
  avatar?: string;
  joinedAt: string;
  lastActive: string;
}

export interface SharedView {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  config: Record<string, unknown>;
  sharedWith: string[];
  createdAt: string;
}

// Phase 36: Performance Optimization
export interface CacheConfig {
  id: string;
  name: string;
  ttl: number;
  maxSize: number;
  enabled: boolean;
}

export interface PerformanceMetric2 {
  id: string;
  name: string;
  value: number;
  unit: string;
  timestamp: string;
}

// Phase 37: Internationalization
export interface Locale {
  code: string;
  name: string;
  nativeName: string;
}

export interface Translation {
  [key: string]: string | Translation;
}

// Phase 38-47: Additional Features
export interface UserPreferences {
  theme: "light" | "dark" | "system";
  language: string;
  timezone: string;
  notifications: boolean;
  autoRefresh: boolean;
  refreshInterval: number;
}

export interface SystemStatus {
  id: string;
  component: string;
  status: "operational" | "degraded" | "outage";
  uptime: number;
  lastIncident: string | null;
  responseTime: number;
}

export interface ActivityLogEntry2 {
  id: string;
  userId: string;
  action: string;
  resource: string;
  details: string;
  timestamp: string;
}

export interface HelpArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
}

// Phase 48-51: Deployment & Production Features
export interface Environment {
  id: string;
  name: string;
  type: "development" | "staging" | "production" | "qa";
  url: string;
  status: "active" | "inactive" | "maintenance";
  version: string;
  lastDeployed: string;
  deployedBy: string;
}

export interface DeploymentPipeline {
  id: string;
  name: string;
  environments: string[];
  stages: PipelineStage2[];
  trigger: "manual" | "auto" | "scheduled";
  enabled: boolean;
  createdAt: string;
}

export interface PipelineStage2 {
  id: string;
  name: string;
  type: "build" | "test" | "deploy" | "approve" | "notify";
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  duration?: number;
  startedAt?: string;
  completedAt?: string;
}

export interface DeploymentRecord {
  id: string;
  version: string;
  environment: string;
  pipeline: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "rolled_back";
  startedAt: string;
  completedAt: string | null;
  deployedBy: string;
  changes: string[];
  metrics?: DeploymentMetrics;
}

export interface DeploymentMetrics {
  responseTime: number;
  errorRate: number;
  throughput: number;
  availability: number;
}

export interface RollbackConfig {
  id: string;
  deploymentId: string;
  targetVersion: string;
  reason: string;
  initiatedBy: string;
  initiatedAt: string;
  status: "pending" | "in_progress" | "completed" | "failed";
}

export interface DeploymentState {
  environments: Environment[];
  pipelines: DeploymentPipeline[];
  deployments: DeploymentRecord[];
  rollbacks: RollbackConfig[];
}
