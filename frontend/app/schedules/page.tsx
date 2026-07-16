"use client";

import { AuthGate } from "@/components/layout/AuthGate";
import { AppShell } from "@/components/layout/AppShell";
import { LazySection } from "@/components/dashboard/LazySection";
import { LazyTestScheduler } from "@/components/dashboard/lazy-sections";
import { useSimulation } from "@/hooks/useSimulation";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useTestStore } from "@/store/test-store";

export default function SchedulesPage() {
  useWebSocket();
  useSimulation();
  const hydrated = useTestStore((s) => s.hydrated);
  const schedules = useTestStore((s) => s.schedules);

  return (
    <AuthGate>
      <AppShell subtitle="Automation" title="Test schedules">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {schedules.length} schedule{schedules.length === 1 ? "" : "s"} configured.
          The control plane polls due schedules every 30 seconds.
        </p>
        {hydrated && (
          <LazySection>
            <LazyTestScheduler />
          </LazySection>
        )}
      </AppShell>
    </AuthGate>
  );
}
