"use client";

import { AuthGate } from "@/components/layout/AuthGate";
import { AppShell } from "@/components/layout/AppShell";
import { ActiveTestsTable } from "@/components/tests/ActiveTestsTable";
import { BulkActions } from "@/components/tests/BulkActions";
import { CreateTestModal } from "@/components/tests/CreateTestModal";
import { useApiMetrics } from "@/hooks/useApiMetrics";
import { useSimulation } from "@/hooks/useSimulation";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useTestStore } from "@/store/test-store";

export default function TestsPage() {
  useWebSocket();
  useSimulation();
  useApiMetrics(1000);
  const hydrated = useTestStore((s) => s.hydrated);

  return (
    <AuthGate>
      <AppShell
        subtitle="Test catalog"
        title="Performance tests"
      >
        {!hydrated ? (
          <div className="animate-pulse rounded-xl border p-8 text-sm text-slate-500">
            Loading tests…
          </div>
        ) : (
          <>
            <BulkActions />
            <ActiveTestsTable />
            <CreateTestModal />
          </>
        )}
      </AppShell>
    </AuthGate>
  );
}
