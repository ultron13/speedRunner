"use client";

import { useState } from "react";
import { Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SystemStatus } from "@/types";

const statusConfig: Record<SystemStatus["status"], { icon: typeof CheckCircle2; color: string }> = {
  operational: { icon: CheckCircle2, color: "text-emerald-600" },
  degraded: { icon: AlertTriangle, color: "text-amber-600" },
  outage: { icon: XCircle, color: "text-rose-600" },
};

const mockStatuses: SystemStatus[] = [
  { id: "sys-1", component: "API Server", status: "operational", uptime: 99.99, lastIncident: null, responseTime: 45 },
  { id: "sys-2", component: "Database", status: "operational", uptime: 99.95, lastIncident: null, responseTime: 12 },
  { id: "sys-3", component: "Cache", status: "operational", uptime: 99.99, lastIncident: null, responseTime: 5 },
  { id: "sys-4", component: "WebSocket", status: "operational", uptime: 99.98, lastIncident: null, responseTime: 8 },
  { id: "sys-5", component: "CDN", status: "degraded", uptime: 99.5, lastIncident: "2 hours ago", responseTime: 120 },
];

export function SystemStatusPanel() {
  const [statuses, setStatuses] = useState<SystemStatus[]>(mockStatuses);
  const [lastChecked, setLastChecked] = useState(new Date());

  const refreshStatus = () => {
    setLastChecked(new Date());
    // Simulate status refresh
    setStatuses((prev) =>
      prev.map((s) => ({
        ...s,
        responseTime: s.responseTime + Math.floor(Math.random() * 10 - 5),
      })),
    );
  };

  const operationalCount = statuses.filter((s) => s.status === "operational").length;
  const totalCount = statuses.length;

  return (
    <section aria-labelledby="system-status-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <CardTitle id="system-status-heading" className="text-base flex items-center gap-2">
              <Activity className="size-4" />
              System Status
            </CardTitle>
            <Badge variant={operationalCount === totalCount ? "default" : "destructive"}>
              {operationalCount}/{totalCount} Operational
            </Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={refreshStatus}>
            <RefreshCw className="mr-1 size-4" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <div className="space-y-2">
            {statuses.map((status) => {
              const config = statusConfig[status.status];
              const Icon = config.icon;

              return (
                <div key={status.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Icon className={`size-5 ${config.color}`} />
                    <div>
                      <p className="text-sm font-medium">{status.component}</p>
                      <p className="text-xs text-slate-500">
                        Uptime: {status.uptime}% · Response: {status.responseTime}ms
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {status.status}
                  </Badge>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Last checked: {lastChecked.toLocaleTimeString()}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
