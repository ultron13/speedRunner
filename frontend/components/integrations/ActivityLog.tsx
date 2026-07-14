"use client";

import { Clock, Key, Webhook, Plug, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIntegrationStore } from "@/store/integration-store";
import type { ActivityLogEntry } from "@/types";

const typeIcons: Record<ActivityLogEntry["type"], typeof Clock> = {
  api_call: Key,
  webhook_triggered: Webhook,
  key_generated: Key,
  key_revoked: Key,
  integration_connected: Plug,
  integration_disconnected: Plug,
};

const typeColors: Record<ActivityLogEntry["type"], string> = {
  api_call: "bg-sky-100 text-sky-600",
  webhook_triggered: "bg-violet-100 text-violet-600",
  key_generated: "bg-emerald-100 text-emerald-600",
  key_revoked: "bg-rose-100 text-rose-600",
  integration_connected: "bg-emerald-100 text-emerald-600",
  integration_disconnected: "bg-slate-100 text-slate-600",
};

export function ActivityLog() {
  const activityLog = useIntegrationStore((state) => state.activityLog);
  const clearActivity = useIntegrationStore((state) => state.clearActivity);

  return (
    <section aria-labelledby="activity-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="activity-heading" className="text-base">Activity Log</CardTitle>
          {activityLog.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearActivity}>
              <Trash2 className="mr-1 size-4" />
              Clear
            </Button>
          )}
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {activityLog.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
              <Clock className="size-8 text-slate-300" />
              <p className="font-medium text-slate-700">No activity yet</p>
              <p className="text-sm">API calls and webhook events will appear here.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />
              <div className="space-y-3">
                {activityLog.slice(0, 20).map((entry) => {
                  const Icon = typeIcons[entry.type];
                  return (
                    <div key={entry.id} className="relative flex gap-3">
                      <div className={`relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full ${typeColors[entry.type]}`}>
                        <Icon className="size-3.5" />
                      </div>
                      <div className="flex-1 rounded-lg border p-2.5">
                        <p className="text-sm">{entry.description}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {new Date(entry.timestamp).toLocaleString("en", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
