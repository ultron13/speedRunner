"use client";

import { AuthGate } from "@/components/layout/AuthGate";
import { AppShell } from "@/components/layout/AppShell";
import { RecentRunsTable } from "@/components/tests/RecentRunsTable";
import { RuntimeControls } from "@/components/tests/RuntimeControls";
import { useApiMetrics } from "@/hooks/useApiMetrics";
import { useSimulation } from "@/hooks/useSimulation";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useTestStore } from "@/store/test-store";

export default function RunsPage() {
  useWebSocket();
  useSimulation();
  useApiMetrics(1000);
  const hydrated = useTestStore((s) => s.hydrated);
  const runs = useTestStore((s) => s.runs);

  return (
    <AuthGate>
      <AppShell subtitle="Result repository" title="Test runs">
        {!hydrated ? (
          <div className="animate-pulse rounded-xl border p-8 text-sm text-slate-500">
            Loading runs…
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {runs.length} run{runs.length === 1 ? "" : "s"} in history. Generate
              an engineering report from any completed run via the API or Reports
              page. Use runtime activity to add/stop VUsers mid-run (EPE 25.3).
            </p>
            <RuntimeControls />
            <RecentRunsTable />
          </>
        )}
      </AppShell>
    </AuthGate>
  );
}
