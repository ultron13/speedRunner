"use client";

import { useEffect, useMemo } from "react";

import { LoginForm } from "@/components/auth/LoginForm";
import { UserProfile } from "@/components/auth/UserProfile";
import { UserManagement } from "@/components/auth/UserManagement";
import { TrendCharts } from "@/components/charts/TrendCharts";
import { DashboardCustomizer } from "@/components/dashboard/DashboardCustomizer";
import { InfrastructureHealth } from "@/components/dashboard/InfrastructureHealth";
import { PerformanceAnalytics } from "@/components/dashboard/PerformanceAnalytics";
import { ReportGenerator } from "@/components/dashboard/ReportGenerator";
import { SLAConfig } from "@/components/dashboard/SLAConfig";
import { Header } from "@/components/dashboard/Header";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { ActiveTestsTable } from "@/components/tests/ActiveTestsTable";
import { BulkActions } from "@/components/tests/BulkActions";
import { CreateTestModal } from "@/components/tests/CreateTestModal";
import { RecentRunsTable } from "@/components/tests/RecentRunsTable";
import { RunComparison } from "@/components/tests/RunComparison";
import { TestScheduler } from "@/components/tests/TestScheduler";
import { TestTemplates } from "@/components/tests/TestTemplates";
import { TestTimeline } from "@/components/tests/TestTimeline";
import { APIKeys } from "@/components/integrations/APIKeys";
import { Webhooks } from "@/components/integrations/Webhooks";
import { IntegrationsPanel } from "@/components/integrations/IntegrationsPanel";
import { ActivityLog } from "@/components/integrations/ActivityLog";
import { CustomChartsBuilder } from "@/components/analytics/CustomChartsBuilder";
import { ComparisonTool } from "@/components/analytics/ComparisonTool";
import { GlobalFilters } from "@/components/analytics/GlobalFilters";
import { ToastContainer } from "@/components/ui/toast";
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

  // Initialize auth on mount
  useEffect(() => { initializeAuth(); }, [initializeAuth]);

  // Keyboard shortcuts
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

  // Always hydrate on mount — WS snapshot will override if available
  useEffect(() => { hydrate(); }, [hydrate]);

  // Show login if not authenticated
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
            <DashboardSection sectionId="summary"><SummaryCards /></DashboardSection>
            <DashboardSection sectionId="charts"><TrendCharts /></DashboardSection>
            <DashboardSection sectionId="activeTests"><ActiveTestsTable /></DashboardSection>
            <DashboardSection sectionId="recentRuns"><RecentRunsTable /></DashboardSection>
            <DashboardSection sectionId="comparison"><RunComparison /></DashboardSection>
            <DashboardSection sectionId="analytics"><PerformanceAnalytics /></DashboardSection>
            <div className="grid gap-6 xl:grid-cols-2">
              <DashboardSection sectionId="sla"><SLAConfig /></DashboardSection>
              <DashboardSection sectionId="templates"><TestTemplates /></DashboardSection>
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <DashboardSection sectionId="scheduler"><TestScheduler /></DashboardSection>
              <DashboardSection sectionId="timeline"><TestTimeline /></DashboardSection>
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <DashboardSection sectionId="profile"><UserProfile /></DashboardSection>
              <DashboardSection sectionId="users"><UserManagement /></DashboardSection>
            </div>
            <DashboardSection sectionId="infrastructure"><InfrastructureHealth /></DashboardSection>
            <ReportGenerator />
            <div className="grid gap-6 xl:grid-cols-2">
              <APIKeys />
              <Webhooks />
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <IntegrationsPanel />
              <ActivityLog />
            </div>
            <CustomChartsBuilder />
            <div className="grid gap-6 xl:grid-cols-2">
              <ComparisonTool />
              <GlobalFilters onFilterChange={(filters) => {
                // Store filters in state for future use
                console.log("Filters applied:", filters);
              }} />
            </div>
          </>
        )}
        <BulkActions />
      </main>
      <DashboardCustomizer />
      <CreateTestModal />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="fixed bottom-4 left-4 text-xs text-slate-400 dark:text-slate-500">
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
