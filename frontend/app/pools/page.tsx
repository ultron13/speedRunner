"use client";

import { useEffect, useState } from "react";
import { Server } from "lucide-react";

import { AuthGate } from "@/components/layout/AuthGate";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiClient, isGoBackendEnabled } from "@/lib/api-client";

type Pool = {
  id: string;
  name: string;
  region: string;
  engine: string;
  capacityVUs: number;
  usedVUs: number;
  status: string;
  namespace?: string;
};

const DEMO_POOLS: Pool[] = [
  {
    id: "demo-1",
    name: "Local Simulator Pool",
    region: "local",
    engine: "simulate",
    capacityVUs: 10000,
    usedVUs: 0,
    status: "HEALTHY",
  },
  {
    id: "demo-2",
    name: "US-East K8s JMeter",
    region: "us-east",
    engine: "jmeter",
    capacityVUs: 5000,
    usedVUs: 200,
    status: "HEALTHY",
    namespace: "marathonrunner-execution",
  },
  {
    id: "demo-3",
    name: "EU-West K8s k6",
    region: "eu-west",
    engine: "k6",
    capacityVUs: 5000,
    usedVUs: 0,
    status: "HEALTHY",
  },
];

export default function PoolsPage() {
  const [pools, setPools] = useState<Pool[]>(DEMO_POOLS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!isGoBackendEnabled()) {
      setPools(DEMO_POOLS);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getPools();
      setPools(
        (data || []).map((p) => ({
          id: p.id as string,
          name: p.name as string,
          region: (p.region as string) || "local",
          engine: (p.engine as string) || "simulate",
          capacityVUs: (p.capacityVUs as number) || 0,
          usedVUs: (p.usedVUs as number) || 0,
          status: (p.status as string) || "HEALTHY",
          namespace: p.namespace as string | undefined,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load pools");
      setPools(DEMO_POOLS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <AuthGate>
      <AppShell
        subtitle="Capacity"
        title="Load generator pools"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Reserve VUs across regions and engines before a run starts. Pools map
            to Kubernetes namespaces or in-process simulators.
          </p>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        </div>
        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            {error} — showing demo pools
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pools.map((p) => {
            const pct =
              p.capacityVUs > 0
                ? Math.min(100, Math.round((p.usedVUs / p.capacityVUs) * 100))
                : 0;
            return (
              <Card key={p.id} className="gap-0 py-0">
                <CardHeader className="flex flex-row items-start justify-between px-5 py-4">
                  <div>
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    <p className="mt-1 text-xs text-slate-500">
                      {p.region} · {p.engine}
                      {p.namespace ? ` · ${p.namespace}` : ""}
                    </p>
                  </div>
                  <Server className="size-4 text-slate-400" />
                </CardHeader>
                <CardContent className="space-y-3 px-5 pb-5">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Capacity</span>
                    <span className="font-medium">
                      {p.usedVUs.toLocaleString()} / {p.capacityVUs.toLocaleString()} VUs
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-sky-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm capitalize">
                    <span
                      className={`size-2 rounded-full ${
                        p.status === "HEALTHY" ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                    />
                    {p.status.toLowerCase()}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </AppShell>
    </AuthGate>
  );
}
