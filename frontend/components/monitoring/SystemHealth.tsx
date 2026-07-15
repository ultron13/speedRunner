"use client";

import { useEffect } from "react";
import { Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMonitoringStore } from "@/store/monitoring-store";
import type { HealthStatus } from "@/types";

const statusConfig: Record<HealthStatus, { icon: typeof CheckCircle2; color: string; bg: string }> = {
  healthy: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
  warning: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50" },
  critical: { icon: XCircle, color: "text-rose-600", bg: "bg-rose-50" },
  unknown: { icon: Activity, color: "text-slate-400", bg: "bg-slate-50" },
};

export function SystemHealth() {
  const health = useMonitoringStore((state) => state.health);
  const simulateHealthCheck = useMonitoringStore((state) => state.simulateHealthCheck);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(simulateHealthCheck, 30_000);
    return () => clearInterval(interval);
  }, [simulateHealthCheck]);

  const healthyCount = health.filter((h) => h.status === "healthy").length;
  const totalCount = health.length;

  return (
    <section aria-labelledby="health-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <CardTitle id="health-heading" className="text-base">System Health</CardTitle>
            <Badge variant={healthyCount === totalCount ? "default" : "destructive"}>
              {healthyCount}/{totalCount} Healthy
            </Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={simulateHealthCheck}>
            <RefreshCw className="mr-1 size-4" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <div className="space-y-2">
            {health.map((item) => {
              const config = statusConfig[item.status];
              const Icon = config.icon;

              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between rounded-lg border p-3 ${config.bg}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`size-5 ${config.color}`} />
                    <div>
                      <p className="text-sm font-medium">{item.component}</p>
                      <p className="text-xs text-slate-600">{item.message}</p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p>{new Date(item.lastChecked).toLocaleTimeString()}</p>
                    {item.metrics && (
                      <div className="mt-1 flex gap-2">
                        {Object.entries(item.metrics).map(([key, value]) => (
                          <span key={key}>
                            {key}: {value}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
