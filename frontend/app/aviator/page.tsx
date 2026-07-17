"use client";

import { AuthGate } from "@/components/layout/AuthGate";
import { AppShell } from "@/components/layout/AppShell";
import { AviatorPanel } from "@/components/ai/AviatorPanel";
import { ObservabilityPanel } from "@/components/integrations/ObservabilityPanel";
import { RuntimeControls } from "@/components/tests/RuntimeControls";

export default function AviatorPage() {
  return (
    <AuthGate>
      <AppShell
        subtitle="OpenText EPE CE 25.3 parity"
        title="Aviator & modern engineering"
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Features from{" "}
          <a
            className="font-medium text-sky-700 underline-offset-2 hover:underline dark:text-sky-400"
            href="https://videos.opentext.com/watch/YuVMox3cGu2Gk2FyoLcJwL"
            target="_blank"
            rel="noreferrer"
          >
            Enterprise Performance Engineering CE 25.3
          </a>
          : AI Aviator (scripting + analysis), Splunk APM, OpenTelemetry, runtime
          VUser controls, AWS multi-AZ templates, Vault secrets, LLM protocol, and
          password force-change policy.
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
          <AviatorPanel />
          <div className="space-y-6">
            <RuntimeControls />
            <ObservabilityPanel />
          </div>
        </div>
      </AppShell>
    </AuthGate>
  );
}
