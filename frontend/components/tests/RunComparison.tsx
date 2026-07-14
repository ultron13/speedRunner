"use client";

import { ArrowRight, X } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration, formatMetric } from "@/lib/utils";
import { useTestStore } from "@/store/test-store";
import type { Run } from "@/types";

export function RunComparison() {
  const selectedRunIds = useTestStore((state) => state.selectedRunIds);
  const runs = useTestStore((state) => state.runs);
  const clearSelection = useTestStore((state) => state.clearRunSelection);

  if (selectedRunIds.length < 2) return null;

  const run1 = runs.find((r) => r.id === selectedRunIds[0]);
  const run2 = runs.find((r) => r.id === selectedRunIds[1]);

  if (!run1 || !run2) return null;

  const chartData = [
    {
      metric: "Duration",
      [run1.testName]: run1.duration,
      [run2.testName]: run2.duration,
    },
    {
      metric: "Throughput",
      [run1.testName]: run1.throughput,
      [run2.testName]: run2.throughput,
    },
    {
      metric: "Response Time",
      [run1.testName]: run1.avgResponseTime,
      [run2.testName]: run2.avgResponseTime,
    },
    {
      metric: "Error Rate",
      [run1.testName]: run1.errorRate,
      [run2.testName]: run2.errorRate,
    },
  ];

  const differences = [
    {
      label: "Duration",
      run1: formatDuration(run1.duration),
      run2: formatDuration(run2.duration),
      diff: run2.duration - run1.duration,
      unit: "s",
      better: "lower",
    },
    {
      label: "Throughput",
      run1: formatMetric(run1.throughput, "req/s"),
      run2: formatMetric(run2.throughput, "req/s"),
      diff: run2.throughput - run1.throughput,
      unit: "req/s",
      better: "higher",
    },
    {
      label: "Avg Response Time",
      run1: formatMetric(run1.avgResponseTime, "ms"),
      run2: formatMetric(run2.avgResponseTime, "ms"),
      diff: run2.avgResponseTime - run1.avgResponseTime,
      unit: "ms",
      better: "lower",
    },
    {
      label: "Error Rate",
      run1: `${run1.errorRate.toFixed(1)}%`,
      run2: `${run2.errorRate.toFixed(1)}%`,
      diff: run2.errorRate - run1.errorRate,
      unit: "%",
      better: "lower",
    },
  ];

  return (
    <section aria-labelledby="comparison-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="comparison-heading" className="text-base">
            Run Comparison
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            <X className="mr-1 size-4" />
            Clear Selection
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 px-5 pb-4">
          {/* Run Headers */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <RunHeader run={run1} label="Run A" />
            <ArrowRight className="size-5 text-slate-400" />
            <RunHeader run={run2} label="Run B" />
          </div>

          {/* Comparison Table */}
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Metric</th>
                  <th className="px-4 py-2 text-right font-medium">{run1.testName}</th>
                  <th className="px-4 py-2 text-right font-medium">{run2.testName}</th>
                  <th className="px-4 py-2 text-right font-medium">Difference</th>
                </tr>
              </thead>
              <tbody>
                {differences.map((diff) => (
                  <tr key={diff.label} className="border-t">
                    <td className="px-4 py-2 font-medium">{diff.label}</td>
                    <td className="px-4 py-2 text-right">{diff.run1}</td>
                    <td className="px-4 py-2 text-right">{diff.run2}</td>
                    <td className="px-4 py-2 text-right">
                      <span
                        className={
                          diff.better === "lower"
                            ? diff.diff < 0
                              ? "text-emerald-600"
                              : diff.diff > 0
                                ? "text-rose-600"
                                : ""
                            : diff.diff > 0
                              ? "text-emerald-600"
                              : diff.diff < 0
                                ? "text-rose-600"
                                : ""
                        }
                      >
                        {diff.diff > 0 ? "+" : ""}
                        {diff.unit === "s"
                          ? formatDuration(Math.abs(diff.diff))
                          : `${Math.abs(diff.diff).toFixed(diff.unit === "%" ? 1 : 0)} ${diff.unit}`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bar Chart */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 14, left: -14, bottom: 0 }}>
                <CartesianGrid stroke="#e7edf1" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="metric" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#dce5eb", fontSize: 12 }} />
                <Legend />
                <Bar dataKey={run1.testName} fill="#209dd7" radius={[4, 4, 0, 0]} />
                <Bar dataKey={run2.testName} fill="#753991" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function RunHeader({ run, label }: { run: Run; label: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-medium">{run.testName}</p>
      <p className="text-xs text-slate-500">
        {new Date(run.completedAt).toLocaleDateString("en", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </div>
  );
}
