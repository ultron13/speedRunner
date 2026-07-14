"use client";

import { useMemo, useState } from "react";
import { Clock, CheckCircle2, XCircle, AlertTriangle, Calendar } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDuration, formatMetric } from "@/lib/utils";
import { useTestStore } from "@/store/test-store";
import type { TimelineEvent } from "@/types";

const eventIcons: Record<TimelineEvent["type"], typeof Clock> = {
  started: Clock,
  completed: CheckCircle2,
  failed: XCircle,
  stopped: AlertTriangle,
  scheduled: Calendar,
};

const eventColors: Record<TimelineEvent["type"], string> = {
  started: "bg-sky-100 text-sky-600",
  completed: "bg-emerald-100 text-emerald-600",
  failed: "bg-rose-100 text-rose-600",
  stopped: "bg-amber-100 text-amber-600",
  scheduled: "bg-violet-100 text-violet-600",
};

export function TestTimeline() {
  const tests = useTestStore((state) => state.tests);
  const getTimeline = useTestStore((state) => state.getTimeline);

  const [selectedTestId, setSelectedTestId] = useState<string>("all");

  const timeline = useMemo(
    () => getTimeline(selectedTestId === "all" ? undefined : selectedTestId),
    [getTimeline, selectedTestId],
  );

  return (
    <section aria-labelledby="timeline-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="timeline-heading" className="text-base">Test Timeline</CardTitle>
          <Select value={selectedTestId} onValueChange={setSelectedTestId}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tests</SelectItem>
              {tests.map((test) => (
                <SelectItem key={test.id} value={test.id}>
                  {test.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {timeline.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
              <Clock className="size-8 text-slate-300" />
              <p className="font-medium text-slate-700">No events yet</p>
              <p className="text-sm">Test events will appear here as they happen.</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />

              <div className="space-y-4">
                {timeline.map((event) => {
                  const Icon = eventIcons[event.type];
                  return (
                    <div key={event.id} className="relative flex gap-4">
                      {/* Icon */}
                      <div className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ${eventColors[event.type]}`}>
                        <Icon className="size-4" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 rounded-lg border p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{event.testName}</p>
                          <p className="text-xs text-slate-500">
                            {new Date(event.timestamp).toLocaleString("en", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <p className="mt-1 text-xs capitalize text-slate-600">{event.type}</p>
                        {event.metadata && (
                          <div className="mt-2 flex gap-4 text-xs text-slate-500">
                            {event.metadata.duration !== undefined && (
                              <span>Duration: {formatDuration(event.metadata.duration)}</span>
                            )}
                            {event.metadata.throughput !== undefined && (
                              <span>Throughput: {formatMetric(event.metadata.throughput, "req/s")}</span>
                            )}
                            {event.metadata.avgResponseTime !== undefined && (
                              <span>Response: {formatMetric(event.metadata.avgResponseTime, "ms")}</span>
                            )}
                            {event.metadata.errorRate !== undefined && (
                              <span>Errors: {event.metadata.errorRate.toFixed(1)}%</span>
                            )}
                          </div>
                        )}
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
