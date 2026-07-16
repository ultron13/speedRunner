"use client";

import { useEffect, useState } from "react";
import { Cpu } from "lucide-react";

import { AuthGate } from "@/components/layout/AuthGate";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient, isGoBackendEnabled } from "@/lib/api-client";

type Engine = {
  name: string;
  displayName: string;
  image: string;
  version: string;
  resultFormat: string;
  scaleModel: string;
  available: boolean;
  supportedControls: string[];
};

const DEMO: Engine[] = [
  { name: "simulate", displayName: "Simulator", image: "in-process", version: "1.0", resultFormat: "json", scaleModel: "inprocess", available: true, supportedControls: ["start", "stop"] },
  { name: "jmeter", displayName: "Apache JMeter", image: "apache/jmeter:5.6.3", version: "5.6.3", resultFormat: "jtl", scaleModel: "job", available: false, supportedControls: ["start", "stop"] },
  { name: "k6", displayName: "Grafana k6", image: "grafana/k6:latest", version: "latest", resultFormat: "json", scaleModel: "job", available: false, supportedControls: ["start", "stop"] },
  { name: "gatling", displayName: "Gatling", image: "denvazh/gatling:latest", version: "3.10", resultFormat: "simulation-log", scaleModel: "job", available: false, supportedControls: ["start", "stop"] },
  { name: "locust", displayName: "Locust", image: "locustio/locust:latest", version: "2.x", resultFormat: "csv", scaleModel: "distributed", available: false, supportedControls: ["start", "stop"] },
  { name: "playwright", displayName: "Playwright", image: "mcr.microsoft.com/playwright", version: "1.40", resultFormat: "json", scaleModel: "job", available: false, supportedControls: ["start", "stop"] },
];

export default function EnginesPage() {
  const [engines, setEngines] = useState<Engine[]>(DEMO);

  useEffect(() => {
    if (!isGoBackendEnabled()) return;
    void apiClient.getEngines().then((data) => {
      setEngines(
        (data || []).map((e) => ({
          name: e.name as string,
          displayName: (e.displayName as string) || (e.name as string),
          image: (e.image as string) || "",
          version: (e.version as string) || "",
          resultFormat: (e.resultFormat as string) || "",
          scaleModel: (e.scaleModel as string) || "",
          available: Boolean(e.available),
          supportedControls: (e.supportedControls as string[]) || [],
        })),
      );
    }).catch(() => undefined);
  }, []);

  return (
    <AuthGate>
      <AppShell subtitle="Phase 4.1" title="Multi-engine catalog">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          JMeter, k6, Gatling, Locust, Playwright, HTTP, and simulator engines with a unified
          abstraction for image, controls, and results.
        </p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {engines.map((e) => (
            <Card key={e.name} className="gap-0 py-0">
              <CardHeader className="flex flex-row items-start justify-between px-5 py-4">
                <div>
                  <CardTitle className="text-base">{e.displayName}</CardTitle>
                  <p className="mt-1 font-mono text-xs text-slate-500">{e.name}</p>
                </div>
                <Cpu className="size-4 text-slate-400" />
              </CardHeader>
              <CardContent className="space-y-2 px-5 pb-5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Status</span>
                  <span className={e.available ? "text-emerald-600" : "text-amber-600"}>
                    {e.available ? "available" : "needs K8s"}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Image</span>
                  <span className="truncate text-right text-xs">{e.image}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Scale</span>
                  <span>{e.scaleModel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Results</span>
                  <span>{e.resultFormat}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </AppShell>
    </AuthGate>
  );
}