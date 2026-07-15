"use client";

import { AlertTriangle, CheckCircle2, Trash2, Shield, Key, Database, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSecurityStore } from "@/store/security-store";
import type { SecurityAlert } from "@/types";

const typeIcons: Record<SecurityAlert["type"], typeof Shield> = {
  login: Shield,
  password: Key,
  api: Key,
  data: Database,
  compliance: Lock,
};

const severityConfig: Record<SecurityAlert["severity"], { color: string; bg: string }> = {
  low: { color: "text-sky-600", bg: "bg-sky-50" },
  medium: { color: "text-amber-600", bg: "bg-amber-50" },
  high: { color: "text-orange-600", bg: "bg-orange-50" },
  critical: { color: "text-rose-600", bg: "bg-rose-50" },
};

export function SecurityAlerts() {
  const securityAlerts = useSecurityStore((state) => state.securityAlerts);
  const resolveAlert = useSecurityStore((state) => state.resolveSecurityAlert);
  const clearAlerts = useSecurityStore((state) => state.clearSecurityAlerts);

  const unresolvedCount = securityAlerts.filter((a) => !a.resolved).length;

  return (
    <section aria-labelledby="security-alerts-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <CardTitle id="security-alerts-heading" className="text-base flex items-center gap-2">
              <AlertTriangle className="size-4" />
              Security Alerts
            </CardTitle>
            {unresolvedCount > 0 && (
              <Badge variant="destructive">{unresolvedCount}</Badge>
            )}
          </div>
          {securityAlerts.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAlerts}>
              <Trash2 className="mr-1 size-4" />
              Clear
            </Button>
          )}
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {securityAlerts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
              <CheckCircle2 className="size-8 text-emerald-400" />
              <p className="font-medium text-slate-700">No security alerts</p>
              <p className="text-sm">All security checks passed.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {securityAlerts.slice(0, 10).map((alert) => {
                const Icon = typeIcons[alert.type];
                const config = severityConfig[alert.severity];

                return (
                  <div
                    key={alert.id}
                    className={`flex items-start justify-between rounded-lg border p-3 ${
                      alert.resolved ? "opacity-50" : config.bg
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={`mt-0.5 size-5 ${config.color}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{alert.type}</p>
                          <Badge variant="outline" className={`text-xs ${config.color}`}>
                            {alert.severity}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-600">{alert.message}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(alert.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {!alert.resolved && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => resolveAlert(alert.id)}
                      >
                        <CheckCircle2 className="mr-1 size-4" />
                        Resolve
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
