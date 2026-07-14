"use client";

import { CheckCircle2, Gauge, Layers3, PlayCircle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatMetric } from "@/lib/utils";
import {
  selectAvgResponseTime,
  selectCompletedRuns,
  selectRunningTests,
  selectTotalTests,
  useTestStore,
} from "@/store/test-store";

const summaries = [
  { label: "Total Tests", selector: selectTotalTests, icon: Layers3, accent: "bg-slate-100 text-slate-700", format: (value: number) => value.toString() },
  { label: "Running Tests", selector: selectRunningTests, icon: PlayCircle, accent: "bg-sky-100 text-sky-700", format: (value: number) => value.toString() },
  { label: "Completed Runs", selector: selectCompletedRuns, icon: CheckCircle2, accent: "bg-emerald-100 text-emerald-700", format: (value: number) => value.toString() },
  { label: "Avg Response Time", selector: selectAvgResponseTime, icon: Gauge, accent: "bg-violet-100 text-violet-700", format: (value: number) => formatMetric(value, "ms") },
];

function SummaryCard({ summary }: { summary: (typeof summaries)[number] }) {
  const value = useTestStore(summary.selector);
  const Icon = summary.icon;

  return (
    <Card className="gap-0 py-0 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex size-11 items-center justify-center rounded-xl ${summary.accent}`}>
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm text-slate-500">{summary.label}</p>
          <p className="mt-0.5 text-2xl font-bold tracking-tight">{summary.format(value)}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function SummaryCards() {
  return (
    <section aria-label="Dashboard summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {summaries.map((summary) => <SummaryCard key={summary.label} summary={summary} />)}
    </section>
  );
}
