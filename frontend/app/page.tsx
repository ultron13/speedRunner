"use client";

import { useEffect, useMemo } from "react";

// Critical path — eagerly imported (above the fold)
import { LoginForm } from "@/components/auth/LoginForm";
import { Header } from "@/components/dashboard/Header";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { ActiveTestsTable } from "@/components/tests/ActiveTestsTable";
import { RecentRunsTable } from "@/components/tests/RecentRunsTable";
import { BulkActions } from "@/components/tests/BulkActions";
import { DashboardCustomizer } from "@/components/dashboard/DashboardCustomizer";
import { CreateTestModal } from "@/components/tests/CreateTestModal";
import { ToastContainer } from "@/components/ui/toast";
import { MobileNav } from "@/components/mobile/MobileNav";
import { OfflineIndicator } from "@/components/mobile/OfflineIndicator";
import { TrendCharts } from "@/components/charts/TrendCharts";

// Lazy-loaded sections
import { LazySection } from "@/components/dashboard/LazySection";
import {
  LazyPerformanceAnalytics,
  LazyComparisonTool,
  LazyGlobalFilters,
  LazyCustomChartsBuilder,
} from "@/components/dashboard/lazy-sections";
import {
  LazyAnomalyDetection,
  LazyPredictiveAnalytics,
  LazySmartRecommendations,
} from "@/components/dashboard/lazy-sections";
import {
  LazyAdvancedCharts,
  LazyReportTemplates,
  LazyScheduledReports,
  LazyReportGenerator,
} from "@/components/dashboard/lazy-sections";
import {
  LazyTwoFactorAuth,
  LazySessionManagement,
  LazyComplianceAudit,
  LazySecurityAlerts,
} from "@/components/dashboard/lazy-sections";
import {
  LazyCICDPipelines,
  LazyAutomationRules,
  LazyDeploymentTracking,
} from "@/components/dashboard/lazy-sections";
import {
  LazyDataExports,
  LazyDataImports,
  LazyScheduledExports,
} from "@/components/dashboard/lazy-sections";
import {
  LazySystemHealth,
  LazyPerformanceMonitor,
  LazyErrorTracker,
  LazyAuditTrail,
} from "@/components/dashboard/lazy-sections";
import {
  LazyTeamWorkspaces,
  LazyUserActivityFeed,
  LazyTeamManagement,
} from "@/components/dashboard/lazy-sections";
import {
  LazyTestConfigurations,
  LazyChaosScenarios,
  LazyLoadProfiles,
  LazyTestScheduler,
  LazyTestTimeline,
  LazyTestTemplates,
  LazyRunComparison,
} from "@/components/dashboard/lazy-sections";
import {
  LazyAPIKeys,
  LazyWebhooks,
  LazyIntegrationsPanel,
  LazyActivityLog,
} from "@/components/dashboard/lazy-sections";
import {
  LazyExportDashboard,
  LazyShareableLinks,
  LazyEmailReports,
  LazyDataImport,
} from "@/components/dashboard/lazy-sections";
import {
  LazyUserPreferencesPanel,
  LazySystemStatusPanel,
  LazyHelpPanel,
  LazyLanguageSelector,
  LazySLAConfig,
} from "@/components/dashboard/lazy-sections";
import {
  LazyEnvironmentManager,
  LazyDeploymentPipelines,
  LazyDeploymentHistory,
} from "@/components/dashboard/lazy-sections";
import {
  LazyInfrastructureHealth,
  LazyGlobalSearch,
  LazyOnlineUsers,
  LazyRealTimeNotifications,
  LazyPerformanceBenchmark,
  LazyAPIDocumentation,
  LazyAlertRules,
  LazyUserProfile,
  LazyUserManagement,
} from "@/components/dashboard/lazy-sections";

// Hooks & stores
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useSimulation } from "@/hooks/useSimulation";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/hooks/useToast";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAuthStore } from "@/store/auth-store";
import { useDashboardStore, selectSectionVisible } from "@/store/dashboard-store";
import { useTestStore } from "@/store/test-store";

function DashboardSection({ sectionId, children }: { sectionId: string; children: React.ReactNode }) {
  const isVisible = useDashboardStore(selectSectionVisible(sectionId as never));
  const collapsed = useDashboardStore((state) => state.sections.find((s) => s.id === sectionId)?.collapsed ?? false);
  const toggleCollapsed = useDashboardStore((state) => state.toggleSectionCollapsed);

  if (!isVisible) return null;

  return (
    <div className="relative">
      <button
        onClick={() => toggleCollapsed(sectionId as never)}
        className="absolute -left-2 top-0 z-10 rounded p-1 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100 dark:hover:bg-slate-800"
        aria-label={collapsed ? "Expand section" : "Collapse section"}
      >
        {collapsed ? "+" : "−"}
      </button>
      {collapsed ? (
        <div className="cursor-pointer rounded-lg border border-dashed p-4 text-center text-sm text-slate-500 hover:border-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950" onClick={() => toggleCollapsed(sectionId as never)}>
          Click to expand {sectionId}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

export default function DashboardPage() {
  const hydrated = useTestStore((state) => state.hydrated);
  const connected = useTestStore((state) => state.connected);
  const hydrate = useTestStore((state) => state.hydrate);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const initializeAuth = useAuthStore((state) => state.initialize);

  const { error: wsError } = useWebSocket();
  useSimulation();
  useTheme();
  const { toasts, removeToast } = useToast();

  useEffect(() => { initializeAuth(); }, [initializeAuth]);

  const shortcuts = useMemo(
    () => ({
      "ctrl+k": () => {
        const searchInput = document.querySelector<HTMLInputElement>(
          'input[placeholder*="Search"]',
        );
        searchInput?.focus();
      },
      "ctrl+n": () => {
        const newTestButton = document.querySelector<HTMLButtonElement>(
          'button[aria-label*="new test" i]',
        );
        newTestButton?.click();
      },
    }),
    [],
  );
  useKeyboardShortcuts(shortcuts);

  useEffect(() => { hydrate(); }, [hydrate]);

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Header />
      {!connected && hydrated && wsError && (
        <div className="mx-auto max-w-[1440px] px-4 pt-4 sm:px-6 lg:px-8">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {wsError}
          </div>
        </div>
      )}
      <main className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div>
          <p className="text-sm font-medium text-sky-700 dark:text-sky-400">Operations overview</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight dark:text-white sm:text-3xl">Performance dashboard</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Monitor active load tests, response trends, and test infrastructure.</p>
        </div>
        {!hydrated ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* Critical: always eagerly loaded */}
            <DashboardSection sectionId="summary"><SummaryCards /></DashboardSection>
            <DashboardSection sectionId="charts"><TrendCharts /></DashboardSection>
            <DashboardSection sectionId="activeTests"><ActiveTestsTable /></DashboardSection>
            <DashboardSection sectionId="recentRuns"><RecentRunsTable /></DashboardSection>

            {/* Below the fold: lazy loaded */}
            <DashboardSection sectionId="comparison"><LazySection><LazyRunComparison /></LazySection></DashboardSection>
            <DashboardSection sectionId="analytics"><LazySection><LazyPerformanceAnalytics /></LazySection></DashboardSection>
            <div className="grid gap-6 xl:grid-cols-2">
              <DashboardSection sectionId="sla"><LazySection><LazySLAConfig /></LazySection></DashboardSection>
              <DashboardSection sectionId="templates"><LazySection><LazyTestTemplates /></LazySection></DashboardSection>
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <DashboardSection sectionId="scheduler"><LazySection><LazyTestScheduler /></LazySection></DashboardSection>
              <DashboardSection sectionId="timeline"><LazySection><LazyTestTimeline /></LazySection></DashboardSection>
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <DashboardSection sectionId="profile"><LazySection><LazyUserProfile /></LazySection></DashboardSection>
              <DashboardSection sectionId="users"><LazySection><LazyUserManagement /></LazySection></DashboardSection>
            </div>
            <DashboardSection sectionId="infrastructure"><LazySection><LazyInfrastructureHealth /></LazySection></DashboardSection>
            <LazySection><LazyReportGenerator /></LazySection>
            <div className="grid gap-6 xl:grid-cols-2">
              <LazySection><LazyAPIKeys /></LazySection>
              <LazySection><LazyWebhooks /></LazySection>
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <LazySection><LazyIntegrationsPanel /></LazySection>
              <LazySection><LazyActivityLog /></LazySection>
            </div>
            <LazySection><LazyCustomChartsBuilder /></LazySection>
            <div className="grid gap-6 xl:grid-cols-2">
              <LazySection><LazyComparisonTool /></LazySection>
              <LazySection><LazyGlobalFilters onFilterChange={(filters) => {
                console.log("Filters applied:", filters);
              }} /></LazySection>
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <LazySection><LazyExportDashboard /></LazySection>
              <LazySection><LazyShareableLinks /></LazySection>
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <LazySection><LazyEmailReports /></LazySection>
              <LazySection><LazyDataImport /></LazySection>
            </div>
            <LazySection><LazyGlobalSearch /></LazySection>
            <div className="grid gap-6 xl:grid-cols-2">
              <LazySection><LazySystemHealth /></LazySection>
              <LazySection><LazyPerformanceMonitor /></LazySection>
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <LazySection><LazyErrorTracker /></LazySection>
              <LazySection><LazyAuditTrail /></LazySection>
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <LazySection><LazyTeamWorkspaces /></LazySection>
              <LazySection><LazyUserActivityFeed /></LazySection>
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <LazySection><LazyTestConfigurations /></LazySection>
              <LazySection><LazyChaosScenarios /></LazySection>
            </div>
            <LazySection><LazyLoadProfiles /></LazySection>
            <div className="grid gap-6 xl:grid-cols-2">
              <LazySection><LazyOnlineUsers /></LazySection>
              <LazySection><LazyRealTimeNotifications /></LazySection>
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <LazySection><LazyAnomalyDetection /></LazySection>
              <LazySection><LazyPredictiveAnalytics /></LazySection>
            </div>
            <LazySection><LazySmartRecommendations /></LazySection>
            <div className="grid gap-6 xl:grid-cols-2">
              <LazySection><LazyAdvancedCharts /></LazySection>
              <LazySection><LazyReportTemplates /></LazySection>
            </div>
            <LazySection><LazyScheduledReports /></LazySection>
            <div className="grid gap-6 xl:grid-cols-2">
              <LazySection><LazyTwoFactorAuth /></LazySection>
              <LazySection><LazySessionManagement /></LazySection>
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <LazySection><LazyComplianceAudit /></LazySection>
              <LazySection><LazySecurityAlerts /></LazySection>
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <LazySection><LazyCICDPipelines /></LazySection>
              <LazySection><LazyAutomationRules /></LazySection>
            </div>
            <LazySection><LazyDeploymentTracking /></LazySection>
            <div className="grid gap-6 xl:grid-cols-2">
              <LazySection><LazyDataExports /></LazySection>
              <LazySection><LazyDataImports /></LazySection>
            </div>
            <LazySection><LazyScheduledExports /></LazySection>
            <div className="grid gap-6 xl:grid-cols-2">
              <LazySection><LazyPerformanceBenchmark /></LazySection>
              <LazySection><LazyAPIDocumentation /></LazySection>
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <LazySection><LazyAlertRules /></LazySection>
              <LazySection><LazyTeamManagement /></LazySection>
            </div>
            <LazySection><LazyLanguageSelector /></LazySection>
            <div className="grid gap-6 xl:grid-cols-2">
              <LazySection><LazyUserPreferencesPanel /></LazySection>
              <LazySection><LazySystemStatusPanel /></LazySection>
            </div>
            <LazySection><LazyHelpPanel /></LazySection>
            <div className="grid gap-6 xl:grid-cols-2">
              <LazySection><LazyEnvironmentManager /></LazySection>
              <LazySection><LazyDeploymentPipelines /></LazySection>
            </div>
            <LazySection><LazyDeploymentHistory /></LazySection>
          </>
        )}
        <BulkActions />
      </main>
      <DashboardCustomizer />
      <CreateTestModal />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <MobileNav activeSection="dashboard" onNavigate={(section) => console.log("Navigate to:", section)} />
      <OfflineIndicator />
      <div className="fixed bottom-4 left-4 hidden text-xs text-slate-400 dark:text-slate-500 lg:block">
        <kbd className="rounded border px-1.5 py-0.5 dark:border-slate-600">Ctrl+K</kbd> Search
        <span className="mx-2">|</span>
        <kbd className="rounded border px-1.5 py-0.5 dark:border-slate-600">Ctrl+N</kbd> New Test
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return <div className="space-y-6" aria-label="Loading dashboard"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />)}</div><div className="grid gap-4 xl:grid-cols-2">{Array.from({ length: 2 }, (_, index) => <div key={index} className="h-64 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" />)}</div><div className="h-80 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700" /></div>;
}
