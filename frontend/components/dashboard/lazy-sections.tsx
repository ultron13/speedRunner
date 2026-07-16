import { lazy } from "react";

// Analytics chunk
export const LazyPerformanceAnalytics = lazy(() => import("@/components/dashboard/PerformanceAnalytics").then((m) => ({ default: m.PerformanceAnalytics })));
export const LazyComparisonTool = lazy(() => import("@/components/analytics/ComparisonTool").then((m) => ({ default: m.ComparisonTool })));
export const LazyGlobalFilters = lazy(() => import("@/components/analytics/GlobalFilters").then((m) => ({ default: m.GlobalFilters })));
export const LazyCustomChartsBuilder = lazy(() => import("@/components/analytics/CustomChartsBuilder").then((m) => ({ default: m.CustomChartsBuilder })));

// AI chunk
export const LazyAnomalyDetection = lazy(() => import("@/components/ai/AnomalyDetection").then((m) => ({ default: m.AnomalyDetection })));
export const LazyPredictiveAnalytics = lazy(() => import("@/components/ai/PredictiveAnalytics").then((m) => ({ default: m.PredictiveAnalytics })));
export const LazySmartRecommendations = lazy(() => import("@/components/ai/SmartRecommendations").then((m) => ({ default: m.SmartRecommendations })));

// Reporting chunk
export const LazyAdvancedCharts = lazy(() => import("@/components/reporting/AdvancedCharts").then((m) => ({ default: m.AdvancedCharts })));
export const LazyReportTemplates = lazy(() => import("@/components/reporting/ReportTemplates").then((m) => ({ default: m.ReportTemplates })));
export const LazyScheduledReports = lazy(() => import("@/components/reporting/ScheduledReports").then((m) => ({ default: m.ScheduledReports })));
export const LazyReportGenerator = lazy(() => import("@/components/dashboard/ReportGenerator").then((m) => ({ default: m.ReportGenerator })));

// Security chunk
export const LazyTwoFactorAuth = lazy(() => import("@/components/security/TwoFactorAuth").then((m) => ({ default: m.TwoFactorAuth })));
export const LazySessionManagement = lazy(() => import("@/components/security/SessionManagement").then((m) => ({ default: m.SessionManagement })));
export const LazyComplianceAudit = lazy(() => import("@/components/security/ComplianceAudit").then((m) => ({ default: m.ComplianceAudit })));
export const LazySecurityAlerts = lazy(() => import("@/components/security/SecurityAlerts").then((m) => ({ default: m.SecurityAlerts })));

// CI/CD chunk
export const LazyCICDPipelines = lazy(() => import("@/components/cicd/CICDPipelines").then((m) => ({ default: m.CICDPipelines })));
export const LazyAutomationRules = lazy(() => import("@/components/cicd/AutomationRules").then((m) => ({ default: m.AutomationRules })));
export const LazyDeploymentTracking = lazy(() => import("@/components/cicd/DeploymentTracking").then((m) => ({ default: m.DeploymentTracking })));

// Data utilities chunk
export const LazyDataExports = lazy(() => import("@/components/data-utilities/DataExports").then((m) => ({ default: m.DataExports })));
export const LazyDataImports = lazy(() => import("@/components/data-utilities/DataImports").then((m) => ({ default: m.DataImports })));
export const LazyScheduledExports = lazy(() => import("@/components/data-utilities/ScheduledExports").then((m) => ({ default: m.ScheduledExports })));

// Monitoring chunk
export const LazySystemHealth = lazy(() => import("@/components/monitoring/SystemHealth").then((m) => ({ default: m.SystemHealth })));
export const LazyPerformanceMonitor = lazy(() => import("@/components/monitoring/PerformanceMonitor").then((m) => ({ default: m.PerformanceMonitor })));
export const LazyErrorTracker = lazy(() => import("@/components/monitoring/ErrorTracker").then((m) => ({ default: m.ErrorTracker })));
export const LazyAuditTrail = lazy(() => import("@/components/monitoring/AuditTrail").then((m) => ({ default: m.AuditTrail })));

// Collaboration chunk
export const LazyTeamWorkspaces = lazy(() => import("@/components/collaboration/TeamWorkspaces").then((m) => ({ default: m.TeamWorkspaces })));
export const LazyUserActivityFeed = lazy(() => import("@/components/collaboration/UserActivityFeed").then((m) => ({ default: m.UserActivityFeed })));
export const LazyTeamManagement = lazy(() => import("@/components/collaboration/TeamManagement").then((m) => ({ default: m.TeamManagement })));

// Testing chunk
export const LazyTestConfigurations = lazy(() => import("@/components/testing/TestConfigurations").then((m) => ({ default: m.TestConfigurations })));
export const LazyChaosScenarios = lazy(() => import("@/components/testing/ChaosScenarios").then((m) => ({ default: m.ChaosScenarios })));
export const LazyLoadProfiles = lazy(() => import("@/components/testing/LoadProfiles").then((m) => ({ default: m.LoadProfiles })));
export const LazyTestScheduler = lazy(() => import("@/components/tests/TestScheduler").then((m) => ({ default: m.TestScheduler })));
export const LazyTestTimeline = lazy(() => import("@/components/tests/TestTimeline").then((m) => ({ default: m.TestTimeline })));
export const LazyTestTemplates = lazy(() => import("@/components/tests/TestTemplates").then((m) => ({ default: m.TestTemplates })));
export const LazyRunComparison = lazy(() => import("@/components/tests/RunComparison").then((m) => ({ default: m.RunComparison })));

// Integrations chunk
export const LazyAPIKeys = lazy(() => import("@/components/integrations/APIKeys").then((m) => ({ default: m.APIKeys })));
export const LazyWebhooks = lazy(() => import("@/components/integrations/Webhooks").then((m) => ({ default: m.Webhooks })));
export const LazyIntegrationsPanel = lazy(() => import("@/components/integrations/IntegrationsPanel").then((m) => ({ default: m.IntegrationsPanel })));
export const LazyActivityLog = lazy(() => import("@/components/integrations/ActivityLog").then((m) => ({ default: m.ActivityLog })));

// Sharing chunk
export const LazyExportDashboard = lazy(() => import("@/components/sharing/ExportDashboard").then((m) => ({ default: m.ExportDashboard })));
export const LazyShareableLinks = lazy(() => import("@/components/sharing/ShareableLinks").then((m) => ({ default: m.ShareableLinks })));
export const LazyEmailReports = lazy(() => import("@/components/sharing/EmailReports").then((m) => ({ default: m.EmailReports })));
export const LazyDataImport = lazy(() => import("@/components/sharing/DataImport").then((m) => ({ default: m.DataImport })));

// Settings chunk
export const LazyUserPreferencesPanel = lazy(() => import("@/components/preferences/UserPreferencesPanel").then((m) => ({ default: m.UserPreferencesPanel })));
export const LazySystemStatusPanel = lazy(() => import("@/components/system/SystemStatusPanel").then((m) => ({ default: m.SystemStatusPanel })));
export const LazyHelpPanel = lazy(() => import("@/components/help/HelpPanel").then((m) => ({ default: m.HelpPanel })));
export const LazyLanguageSelector = lazy(() => import("@/components/i18n/LanguageSelector").then((m) => ({ default: m.LanguageSelector })));
export const LazySLAConfig = lazy(() => import("@/components/dashboard/SLAConfig").then((m) => ({ default: m.SLAConfig })));

// Deployment chunk
export const LazyEnvironmentManager = lazy(() => import("@/components/deployment/EnvironmentManager").then((m) => ({ default: m.EnvironmentManager })));
export const LazyDeploymentPipelines = lazy(() => import("@/components/deployment/DeploymentPipelines").then((m) => ({ default: m.DeploymentPipelines })));
export const LazyDeploymentHistory = lazy(() => import("@/components/deployment/DeploymentHistory").then((m) => ({ default: m.DeploymentHistory })));

// Infrastructure (standalone)
export const LazyInfrastructureHealth = lazy(() => import("@/components/dashboard/InfrastructureHealth").then((m) => ({ default: m.InfrastructureHealth })));
export const LazyGlobalSearch = lazy(() => import("@/components/search/GlobalSearch").then((m) => ({ default: m.GlobalSearch })));
export const LazyOnlineUsers = lazy(() => import("@/components/realtime/OnlineUsers").then((m) => ({ default: m.OnlineUsers })));
export const LazyRealTimeNotifications = lazy(() => import("@/components/realtime/RealTimeNotifications").then((m) => ({ default: m.RealTimeNotifications })));
export const LazyPerformanceBenchmark = lazy(() => import("@/components/benchmarking/PerformanceBenchmark").then((m) => ({ default: m.PerformanceBenchmark })));
export const LazyAPIDocumentation = lazy(() => import("@/components/api/APIDocumentation").then((m) => ({ default: m.APIDocumentation })));
export const LazyAlertRules = lazy(() => import("@/components/alerting/AlertRules").then((m) => ({ default: m.AlertRules })));
export const LazyUserProfile = lazy(() => import("@/components/auth/UserProfile").then((m) => ({ default: m.UserProfile })));
export const LazyUserManagement = lazy(() => import("@/components/auth/UserManagement").then((m) => ({ default: m.UserManagement })));
