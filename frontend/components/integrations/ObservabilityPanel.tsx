"use client";

import { useEffect, useState } from "react";
import { Cloud, Radio, Shield } from "lucide-react";

import { apiClient, isGoBackendEnabled } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

/** Splunk APM + OpenTelemetry + AWS cloud templates + Vault (EPE 25.3). */
export function ObservabilityPanel() {
  const [splunk, setSplunk] = useState<string>("");
  const [otel, setOtel] = useState<string>("");
  const [aws, setAws] = useState<string>("");
  const [policy, setPolicy] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (!isGoBackendEnabled()) {
      setSplunk("Demo: Splunk APM integration available when Go API is connected");
      setOtel("Demo: OpenTelemetry export to collector");
      setAws("Demo: multi-subnet / multi-instance-type AWS LG templates");
      setPolicy("Force password change after admin reset: enabled");
      return;
    }
    setBusy(true);
    try {
      const [s, o, a, p] = await Promise.all([
        apiClient.getSplunkMetrics(),
        apiClient.getOTEL(),
        apiClient.getAWSTemplates(),
        apiClient.getPasswordPolicy(),
      ]);
      setSplunk(`${s.integration}: ${s.metrics?.length ?? 0} metric point(s)`);
      setOtel(
        `OTEL ${o.config?.enabled ? "enabled" : "disabled"} → ${String(o.config?.endpoint || "(no endpoint)")} · ${o.recent?.length ?? 0} recent spans`,
      );
      setAws(`${a.length} AWS cloud template(s) (multi-subnet / multi-instance)`);
      setPolicy(
        `Force change after reset: ${p.policy?.forceChangeAfterReset ? "on" : "off"} · mustChange=${p.mustChange}`,
      );
    } catch (e) {
      setSplunk(e instanceof Error ? e.message : "Failed to load integrations");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function seedDemo() {
    if (!isGoBackendEnabled()) return;
    setBusy(true);
    try {
      await apiClient.ingestSplunkMetric({
        service: "checkout",
        metric: "latency.p95",
        value: 215,
        unit: "ms",
      });
      await apiClient.configureOTEL({
        enabled: true,
        endpoint: "http://otel-collector:4318",
        protocol: "http",
        serviceName: "speedrunner",
        sampleRate: 1,
      });
      await apiClient.exportOTELSpan({
        name: "run.execute",
        runId: "demo-run",
        durationMs: 42,
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="rounded-xl border bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950"
      aria-labelledby="obs-heading"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="obs-heading" className="text-sm font-semibold">
          Observability, cloud & security (EPE 25.3)
        </h2>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => refresh()}>
            Refresh
          </Button>
          <Button type="button" size="sm" disabled={busy} onClick={() => seedDemo()}>
            Seed Splunk + OTEL
          </Button>
        </div>
      </div>
      <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
        <li className="flex gap-2">
          <Radio className="mt-0.5 size-4 shrink-0 text-orange-500" aria-hidden />
          <span>
            <strong className="font-medium">Splunk APM:</strong> {splunk || "—"}
          </span>
        </li>
        <li className="flex gap-2">
          <Radio className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
          <span>
            <strong className="font-medium">OpenTelemetry:</strong> {otel || "—"}
          </span>
        </li>
        <li className="flex gap-2">
          <Cloud className="mt-0.5 size-4 shrink-0 text-sky-600" aria-hidden />
          <span>
            <strong className="font-medium">AWS cloud templates:</strong> {aws || "—"}
          </span>
        </li>
        <li className="flex gap-2">
          <Shield className="mt-0.5 size-4 shrink-0 text-violet-600" aria-hidden />
          <span>
            <strong className="font-medium">Password policy:</strong> {policy || "—"}
          </span>
        </li>
      </ul>
    </section>
  );
}
