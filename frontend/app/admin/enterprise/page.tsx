"use client";

import { useCallback, useState } from "react";
import {
  Activity,
  GitBranch,
  Layers,
  Loader2,
  Network,
  ShieldAlert,
} from "lucide-react";

import { AuthGate } from "@/components/layout/AuthGate";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient, isGoBackendEnabled } from "@/lib/api-client";

/** Deep enterprise console for roadmap phases 21–41. */
export default function EnterpriseConsolePage() {
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<string>("");
  const [error, setError] = useState("");

  const run = useCallback(async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      if (!isGoBackendEnabled()) {
        setOut(`${label}: connect NEXT_PUBLIC_API_URL for live control-plane results (demo UI only).`);
        return;
      }
      const res = await fn();
      setOut(`${label}\n\n${JSON.stringify(res, null, 2)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <AuthGate>
      <AppShell subtitle="Roadmap 21–41" title="Enterprise console">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Portfolio health, asset versioning, correlation studio, WAN profiles,
          auto-heal, executive packs, quotas, residency gates, flaky detection,
          regression baselines, and platform self-health — wired to the Go
          control plane.
        </p>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 space-y-0">
              <Layers className="size-4 text-sky-600" />
              <CardTitle className="text-base">Portfolio & assets</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() =>
                  run("Portfolio summary", () => apiClient.portfolioSummary())
                }
              >
                Portfolio summary
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run("Asset commit", () =>
                    apiClient.commitAssetVersion({
                      assetId: "login-flow",
                      message: "ui-touch",
                      content: "vuser_init(); // sample",
                    }),
                  )
                }
              >
                Commit asset version
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run("Suggest params", () =>
                    apiClient.suggestParameters({
                      url: "/api/orders/{orderId}",
                      body: '{"email":"a@b.com","password":"x"}',
                    }),
                  )
                }
              >
                Parameter wizard
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run("Correlation detect", () =>
                    apiClient.detectCorrelations({
                      responseBody: '{"access_token":"t","csrf":"c"}',
                    }),
                  )
                }
              >
                Correlation studio
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2 space-y-0">
              <Network className="size-4 text-violet-600" />
              <CardTitle className="text-base">Runtime & network</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() =>
                  run("Network profiles", () => apiClient.getNetworkProfiles())
                }
              >
                WAN + think-time profiles
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run("Auto-heal", () =>
                    apiClient.autoHealGenerator({
                      generatorId: "lg-1",
                      cpuPct: 95,
                      memPct: 80,
                      errorRate: 1,
                      unreachable: false,
                    }),
                  )
                }
              >
                LG auto-heal
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run("Shard aggregate", () =>
                    apiClient.aggregateShards({
                      shards: [
                        { shardId: "a", samples: 100, throughput: 40, avgLatency: 120, errorCount: 1 },
                        { shardId: "b", samples: 100, throughput: 45, avgLatency: 110, errorCount: 0 },
                      ],
                    }),
                  )
                }
              >
                Aggregate shards
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run("Comparison matrix", () =>
                    apiClient.comparisonMatrix({
                      rows: [
                        { runId: "r1", label: "baseline", p95: 200, errorRate: 0.5, throughput: 100 },
                        { runId: "r2", label: "candidate", p95: 180, errorRate: 0.4, throughput: 110 },
                      ],
                    }),
                  )
                }
              >
                Run comparison matrix
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2 space-y-0">
              <ShieldAlert className="size-4 text-amber-600" />
              <CardTitle className="text-base">Governance & health</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() =>
                  run("Executive pack", () =>
                    apiClient.executivePack({
                      title: "Weekly board",
                      score: 78,
                      risks: ["p95 drift on checkout"],
                      costUsd: 420,
                    }),
                  )
                }
              >
                Executive board pack
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run("SLA incident", () =>
                    apiClient.incidentFromSLA({
                      service: "checkout",
                      runId: "run-1",
                      errorRate: 3.2,
                      p95: 1100,
                    }),
                  )
                }
              >
                SLA → incident draft
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run("Residency gate", () =>
                    apiClient.residencyGate({
                      allowedRegions: ["eu-west-1"],
                      requestedRegion: "us-east-1",
                      dataClass: "pii",
                    }),
                  )
                }
              >
                Data residency gate
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run("Self-health", () => apiClient.platformSelfHealth())
                }
              >
                <Activity className="size-3.5" />
                Platform self-health
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  run("Phases 21–41 catalog", () =>
                    apiClient.getPlatformPhases("21-41" as "7" | "8" | "all"),
                  )
                }
              >
                <GitBranch className="size-3.5" />
                Catalog 21–41
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Response</CardTitle>
            {busy && <Loader2 className="size-4 animate-spin text-slate-400" />}
          </CardHeader>
          <CardContent>
            <pre className="max-h-96 overflow-auto rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-900">
              {out || "Run an action to see JSON results."}
            </pre>
          </CardContent>
        </Card>
      </AppShell>
    </AuthGate>
  );
}
