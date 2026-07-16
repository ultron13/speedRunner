"use client";

import { Database, Network, Server } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTimestamp } from "@/lib/utils";
import { useTestStore } from "@/store/test-store";
import type { InfrastructureState } from "@/types";

const iconByComponent = { Controller: Server, "Load Generator": Network, Database };
const statusStyle: Record<InfrastructureState, string> = { healthy: "bg-emerald-500", degraded: "bg-amber-500", down: "bg-rose-500" };

export function InfrastructureHealth() {
  const infrastructure = useTestStore((state) => state.infrastructure);

  return (
    <section aria-labelledby="infrastructure-heading">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="infrastructure-heading" className="text-base font-semibold">
          Infrastructure Health
        </h2>
        <span className="text-sm text-slate-500">Last checks from the controller</span>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {infrastructure.length === 0 ? (
          <p className="text-sm text-slate-500 md:col-span-3">No infrastructure status yet.</p>
        ) : (
          infrastructure.map((item) => {
            const Icon =
              iconByComponent[item.component as keyof typeof iconByComponent] ?? Server;
            return (
              <Card key={item.component} className="gap-0 py-0">
                <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
                  <CardTitle className="text-sm">{item.component}</CardTitle>
                  <Icon className="size-4 text-slate-400" aria-hidden="true" />
                </CardHeader>
                <CardContent className="px-5 pb-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={`size-2 rounded-full ${statusStyle[item.status]}`}
                      aria-hidden="true"
                    />
                    <span className="capitalize">{item.status}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Checked {formatTimestamp(item.lastChecked)}
                  </p>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </section>
  );
}
