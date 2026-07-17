"use client";

import { useState } from "react";
import { Leaf, Loader2 } from "lucide-react";

import { AuthGate } from "@/components/layout/AuthGate";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient, isGoBackendEnabled } from "@/lib/api-client";

export default function FinOpsPage() {
  const [vus, setVus] = useState(500);
  const [durationSec, setDurationSec] = useState(1800);
  const [region, setRegion] = useState("eu-north-1");
  const [networkGb, setNetworkGb] = useState(5);
  const [storageGb, setStorageGb] = useState(2);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  async function estimate() {
    setBusy(true);
    setError("");
    try {
      if (!isGoBackendEnabled()) {
        setResult({
          estimate: {
            vuHours: (vus * durationSec) / 3600,
            totalUsd: 12.5,
            carbonKgCo2e: 0.08,
          },
          grade: "A",
          report: { recommendation: "Prefer low-carbon regions for large suites" },
        });
        return;
      }
      const res = await apiClient.estimateFinOps({
        vus,
        durationSec,
        region,
        networkGb,
        storageGb,
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Estimate failed");
    } finally {
      setBusy(false);
    }
  }

  const est = (result?.estimate || {}) as Record<string, number>;

  return (
    <AuthGate>
      <AppShell subtitle="Cost & sustainability" title="FinOps & carbon">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Estimate compute/network/storage cost and kg CO₂e for a load run, with a
          carbon grade and green-region guidance.
        </p>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Run profile</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium">
                VUs
                <input
                  type="number"
                  className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={vus}
                  onChange={(e) => setVus(Number(e.target.value) || 0)}
                />
              </label>
              <label className="block text-xs font-medium">
                Duration (sec)
                <input
                  type="number"
                  className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={durationSec}
                  onChange={(e) => setDurationSec(Number(e.target.value) || 0)}
                />
              </label>
              <label className="block text-xs font-medium sm:col-span-2">
                Region
                <input
                  className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                />
              </label>
              <label className="block text-xs font-medium">
                Network GB
                <input
                  type="number"
                  className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={networkGb}
                  onChange={(e) => setNetworkGb(Number(e.target.value) || 0)}
                />
              </label>
              <label className="block text-xs font-medium">
                Storage GB
                <input
                  type="number"
                  className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                  value={storageGb}
                  onChange={(e) => setStorageGb(Number(e.target.value) || 0)}
                />
              </label>
              <div className="sm:col-span-2">
                <Button type="button" disabled={busy} onClick={() => estimate()}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Leaf className="size-4" />}
                  Estimate
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {!result ? (
                <p className="text-slate-500">Run an estimate to see cost and carbon.</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border p-3 dark:border-slate-800">
                      <div className="text-xs text-slate-500">Total USD</div>
                      <div className="text-xl font-semibold">
                        ${Number(est.totalUsd ?? 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="rounded-lg border p-3 dark:border-slate-800">
                      <div className="text-xs text-slate-500">Carbon grade</div>
                      <div className="text-xl font-semibold">{String(result.grade)}</div>
                    </div>
                    <div className="rounded-lg border p-3 dark:border-slate-800">
                      <div className="text-xs text-slate-500">VU-hours</div>
                      <div className="text-lg font-medium">
                        {Number(est.vuHours ?? 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="rounded-lg border p-3 dark:border-slate-800">
                      <div className="text-xs text-slate-500">kg CO₂e</div>
                      <div className="text-lg font-medium">
                        {Number(est.carbonKgCo2e ?? 0).toFixed(4)}
                      </div>
                    </div>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">
                    {(result.report as { recommendation?: string })?.recommendation ||
                      "—"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </AppShell>
    </AuthGate>
  );
}
