"use client";

import { AuthGate } from "@/components/layout/AuthGate";
import { AppShell } from "@/components/layout/AppShell";
import { TrendCharts } from "@/components/charts/TrendCharts";
import { LazySection } from "@/components/dashboard/LazySection";
import {
  LazyPerformanceAnalytics,
  LazyAnomalyDetection,
  LazyPredictiveAnalytics,
  LazySmartRecommendations,
  LazyComparisonTool,
} from "@/components/dashboard/lazy-sections";
import { useApiMetrics } from "@/hooks/useApiMetrics";
import { useSimulation } from "@/hooks/useSimulation";
import { useWebSocket } from "@/hooks/useWebSocket";

export default function AnalyticsPage() {
  useWebSocket();
  useSimulation();
  useApiMetrics(1000);

  return (
    <AuthGate>
      <AppShell subtitle="Insights" title="Performance analytics">
        <TrendCharts />
        <div className="grid gap-6 xl:grid-cols-2">
          <LazySection>
            <LazyPerformanceAnalytics />
          </LazySection>
          <LazySection>
            <LazyComparisonTool />
          </LazySection>
        </div>
        <div className="grid gap-6 xl:grid-cols-3">
          <LazySection>
            <LazyAnomalyDetection />
          </LazySection>
          <LazySection>
            <LazyPredictiveAnalytics />
          </LazySection>
          <LazySection>
            <LazySmartRecommendations />
          </LazySection>
        </div>
      </AppShell>
    </AuthGate>
  );
}
