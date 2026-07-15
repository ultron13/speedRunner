"use client";

import { useState } from "react";
import { History, Trash2, User, Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useMonitoringStore } from "@/store/monitoring-store";

const actionColors: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-700",
  update: "bg-sky-100 text-sky-700",
  delete: "bg-rose-100 text-rose-700",
  login: "bg-violet-100 text-violet-700",
  logout: "bg-slate-100 text-slate-700",
  export: "bg-amber-100 text-amber-700",
};

export function AuditTrail() {
  const [filter, setFilter] = useState("");
  const auditLog = useMonitoringStore((state) => state.auditLog);
  const clearAuditLog = useMonitoringStore((state) => state.clearAuditLog);

  const filteredLog = filter
    ? auditLog.filter(
        (entry) =>
          entry.action.toLowerCase().includes(filter.toLowerCase()) ||
          entry.resource.toLowerCase().includes(filter.toLowerCase()) ||
          entry.userName.toLowerCase().includes(filter.toLowerCase()),
      )
    : auditLog;

  return (
    <section aria-labelledby="audit-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="audit-heading" className="text-base">Audit Trail</CardTitle>
          <div className="flex items-center gap-2">
            {auditLog.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAuditLog}>
                <Trash2 className="mr-1 size-4" />
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {/* Filter */}
          <div className="mb-4 relative">
            <Filter className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Filter audit log..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-9"
            />
          </div>

          {filteredLog.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
              <History className="size-8 text-slate-300" />
              <p className="font-medium text-slate-700">No audit entries</p>
              <p className="text-sm">User actions will appear here.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />
              <div className="space-y-3">
                {filteredLog.slice(0, 50).map((entry) => (
                  <div key={entry.id} className="relative flex gap-3">
                    <div className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100">
                      <User className="size-3.5 text-slate-600" />
                    </div>
                    <div className="flex-1 rounded-lg border p-2.5">
                      <div className="flex items-center gap-2">
                        <Badge className={actionColors[entry.action] || "bg-slate-100 text-slate-700"}>
                          {entry.action}
                        </Badge>
                        <span className="text-sm font-medium">{entry.resource}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        by {entry.userName} · {new Date(entry.timestamp).toLocaleString()}
                      </p>
                      {entry.details && (
                        <pre className="mt-1 overflow-x-auto text-xs text-slate-500">
                          {JSON.stringify(entry.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
