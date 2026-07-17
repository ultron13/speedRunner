"use client";

import { useState } from "react";
import { Pause, Play, Users } from "lucide-react";

import { apiClient, isGoBackendEnabled } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { useTestStore } from "@/store/test-store";

/** EPE 25.3-style runtime activity: Add/Stop VUsers + Rendezvous during a run. */
export function RuntimeControls() {
  const tests = useTestStore((s) => s.tests);
  const running = tests.filter((t) => t.status === "running");
  const [runId, setRunId] = useState("");
  const [vusers, setVusers] = useState(10);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const effectiveId = runId || running[0]?.id || "";

  async function act(action: "add" | "stop" | "rendezvous" | "ensure") {
    if (!effectiveId) {
      setStatus("Select or start a running test first.");
      return;
    }
    setBusy(true);
    try {
      if (!isGoBackendEnabled()) {
        setStatus(
          `Demo: ${action} ${vusers} VUs on ${effectiveId} (connect Go API for live control)`,
        );
        return;
      }
      const res = await apiClient.runRuntimeAction(effectiveId, {
        action,
        vusers,
        targetVUs: vusers,
        rendezvousName: "checkout-barrier",
        rendezvousPolicy: "percent",
        rendezvousPercent: 80,
      });
      setStatus(
        `OK · activeVUs=${String(res.activeVUs ?? "—")} target=${String(res.targetVUs ?? "—")} rendezvous=${String(res.rendezvousName ?? "—")}`,
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Runtime action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="rounded-xl border bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950"
      aria-labelledby="runtime-heading"
    >
      <div className="mb-3 flex items-center gap-2">
        <Users className="size-4 text-sky-600" aria-hidden />
        <h2 id="runtime-heading" className="text-sm font-semibold">
          Runtime activity
        </h2>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-500 dark:bg-slate-800">
          EPE 25.3
        </span>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Modernized Add VUsers / Stop VUsers / Rendezvous controls during a live run
        (LoadRunner Enterprise parity).
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="rt-run">
            Run / test ID
          </label>
          <input
            id="rt-run"
            list="running-tests"
            value={runId}
            onChange={(e) => setRunId(e.target.value)}
            placeholder={running[0]?.id ?? "run-id"}
            className="w-48 rounded-md border px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <datalist id="running-tests">
            {running.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </datalist>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="rt-vu">
            VUsers
          </label>
          <input
            id="rt-vu"
            type="number"
            min={1}
            value={vusers}
            onChange={(e) => setVusers(Number(e.target.value) || 1)}
            className="w-24 rounded-md border px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        <Button type="button" size="sm" disabled={busy} onClick={() => act("add")}>
          <Play className="size-3.5" /> Add VUsers
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => act("stop")}>
          <Pause className="size-3.5" /> Stop VUsers
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => act("rendezvous")}
        >
          Set Rendezvous
        </Button>
      </div>
      {status && (
        <p className="mt-3 text-xs text-slate-600 dark:text-slate-400" role="status">
          {status}
        </p>
      )}
    </section>
  );
}
