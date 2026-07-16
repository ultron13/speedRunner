"use client";

import { AuthGate } from "@/components/layout/AuthGate";
import { AppShell } from "@/components/layout/AppShell";
import { LazySection } from "@/components/dashboard/LazySection";
import { LazySLAConfig } from "@/components/dashboard/lazy-sections";
import { useTestStore } from "@/store/test-store";

export default function SLAPage() {
  const thresholds = useTestStore((s) => s.slaThresholds);
  const hydrated = useTestStore((s) => s.hydrated);

  return (
    <AuthGate>
      <AppShell subtitle="Quality gates" title="SLA thresholds">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {thresholds.length} threshold{thresholds.length === 1 ? "" : "s"} active.
          Evaluated automatically when a run stops.
        </p>
        {hydrated && (
          <LazySection>
            <LazySLAConfig />
          </LazySection>
        )}
      </AppShell>
    </AuthGate>
  );
}
