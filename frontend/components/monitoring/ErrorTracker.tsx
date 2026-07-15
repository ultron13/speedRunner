"use client";

import { useState, useMemo } from "react";
import { AlertTriangle, CheckCircle2, XCircle, Trash2, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMonitoringStore } from "@/store/monitoring-store";
import type { AppError } from "@/types";

const severityConfig: Record<AppError["severity"], { icon: typeof Info; color: string; bg: string }> = {
  info: { icon: Info, color: "text-sky-600", bg: "bg-sky-50" },
  warning: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50" },
  error: { icon: XCircle, color: "text-rose-600", bg: "bg-rose-50" },
  critical: { icon: AlertTriangle, color: "text-rose-700", bg: "bg-rose-100" },
};

export function ErrorTracker() {
  const [showResolved, setShowResolved] = useState(false);
  const errors = useMonitoringStore((state) => state.errors);
  const resolveError = useMonitoringStore((state) => state.resolveError);
  const clearErrors = useMonitoringStore((state) => state.clearErrors);

  const unresolvedErrors = useMemo(() => errors.filter((e) => !e.resolved), [errors]);
  const displayErrors = showResolved ? errors : unresolvedErrors;

  return (
    <section aria-labelledby="errors-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <CardTitle id="errors-heading" className="text-base">Error Tracker</CardTitle>
            {unresolvedErrors.length > 0 && (
              <Badge variant="destructive">{unresolvedErrors.length} unresolved</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowResolved(!showResolved)}
            >
              {showResolved ? "Hide Resolved" : "Show All"}
            </Button>
            {errors.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearErrors}>
                <Trash2 className="mr-1 size-4" />
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {displayErrors.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
              <CheckCircle2 className="size-8 text-emerald-400" />
              <p className="font-medium text-slate-700">No errors</p>
              <p className="text-sm">All systems operating normally.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayErrors.map((error) => {
                const config = severityConfig[error.severity];
                const Icon = config.icon;

                return (
                  <div
                    key={error.id}
                    className={`flex items-start gap-3 rounded-lg border p-3 ${
                      error.resolved ? "opacity-50" : config.bg
                    }`}
                  >
                    <Icon className={`mt-0.5 size-5 ${config.color}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{error.message}</p>
                        <Badge variant="outline" className="text-xs">
                          {error.severity}
                        </Badge>
                        {error.resolved && (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                            Resolved
                          </Badge>
                        )}
                      </div>
                      {error.component && (
                        <p className="text-xs text-slate-500">Component: {error.component}</p>
                      )}
                      <p className="text-xs text-slate-500">
                        {new Date(error.timestamp).toLocaleString()}
                      </p>
                    </div>
                    {!error.resolved && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => resolveError(error.id)}
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
