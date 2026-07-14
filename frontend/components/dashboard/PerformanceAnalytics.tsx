"use client";

import { useMemo } from "react";
import { TrendingUp, TrendingDown, Award, AlertTriangle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMetric } from "@/lib/utils";
import { useTestStore } from "@/store/test-store";

export function PerformanceAnalytics() {
  const runs = useTestStore((state) => state.runs);
  const getPerformanceStats = useTestStore((state) => state.getPerformanceStats);

  const stats = useMemo(() => getPerformanceStats(), [getPerformanceStats]);

  const responseTimeDistribution = useMemo(() => {
    const completedRuns = runs.filter((r) => r.status === "completed");
    if (completedRuns.length === 0) return [];

    const ranges = [
      { label: "0-100ms", min: 0, max: 100 },
      { label: "100-200ms", min: 100, max: 200 },
      { label: "200-500ms", min: 200, max: 500 },
      { label: "500ms-1s", min: 500, max: 1000 },
      { label: "1s+", min: 1000, max: Infinity },
    ];

    return ranges.map((range) => ({
      name: range.label,
      count: completedRuns.filter(
        (r) => r.avgResponseTime >= range.min && r.avgResponseTime < range.max,
      ).length,
    }));
  }, [runs]);

  const statusDistribution = useMemo(() => {
    const counts = { completed: 0, stopped: 0, failed: 0 };
    runs.forEach((r) => {
      counts[r.status]++;
    });
    return [
      { name: "Completed", value: counts.completed, fill: "#22c55e" },
      { name: "Stopped", value: counts.stopped, fill: "#f59e0b" },
      { name: "Failed", value: counts.failed, fill: "#ef4444" },
    ];
  }, [runs]);

  if (stats.totalRuns === 0) {
    return null;
  }

  return (
    <section aria-labelledby="analytics-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="px-5 py-4">
          <CardTitle id="analytics-heading" className="text-base">Performance Analytics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 px-5 pb-4">
          {/* Percentile Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <PercentileCard label="P50" value={stats.p50ResponseTime} unit="ms" />
            <PercentileCard label="P90" value={stats.p90ResponseTime} unit="ms" />
            <PercentileCard label="P95" value={stats.p95ResponseTime} unit="ms" />
            <PercentileCard label="P99" value={stats.p99ResponseTime} unit="ms" />
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              label="Avg Throughput"
              value={formatMetric(stats.avgThroughput, "req/s")}
              icon={<TrendingUp className="size-4 text-sky-600" />}
            />
            <StatCard
              label="Avg Error Rate"
              value={`${stats.avgErrorRate}%`}
              icon={<AlertTriangle className="size-4 text-amber-600" />}
            />
            <StatCard
              label="Success Rate"
              value={`${stats.successRate}%`}
              icon={<Award className="size-4 text-emerald-600" />}
            />
          </div>

          {/* Best and Worst Runs */}
          <div className="grid gap-4 sm:grid-cols-2">
            {stats.bestRun && (
              <RunHighlightCard
                title="Best Run"
                run={stats.bestRun}
                icon={<TrendingUp className="size-4 text-emerald-600" />}
                variant="success"
              />
            )}
            {stats.worstRun && stats.worstRun.id !== stats.bestRun?.id && (
              <RunHighlightCard
                title="Worst Run"
                run={stats.worstRun}
                icon={<TrendingDown className="size-4 text-rose-600" />}
                variant="warning"
              />
            )}
          </div>

          {/* Charts */}
          <div className="grid gap-4 xl:grid-cols-2">
            {/* Response Time Distribution */}
            {responseTimeDistribution.length > 0 && (
              <div className="h-48">
                <p className="mb-2 text-xs font-medium text-slate-500">Response Time Distribution</p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={responseTimeDistribution} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="#e7edf1" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#dce5eb", fontSize: 12 }} />
                    <Bar dataKey="count" fill="#209dd7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Status Distribution */}
            <div className="h-48">
              <p className="mb-2 text-xs font-medium text-slate-500">Run Status Distribution</p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusDistribution} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#e7edf1" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#dce5eb", fontSize: 12 }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {statusDistribution.map((entry, index) => (
                      <rect key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function PercentileCard({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold">{formatMetric(value, unit)}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function RunHighlightCard({
  title,
  run,
  icon,
  variant,
}: {
  title: string;
  run: { testName: string; avgResponseTime: number; throughput: number; errorRate: number; completedAt: string };
  icon: React.ReactNode;
  variant: "success" | "warning";
}) {
  const borderColor = variant === "success" ? "border-emerald-200" : "border-rose-200";
  const bgColor = variant === "success" ? "bg-emerald-50" : "bg-rose-50";

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} p-3`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="mt-1 text-xs font-medium">{run.testName}</p>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-slate-500">Response</p>
          <p className="font-medium">{formatMetric(run.avgResponseTime, "ms")}</p>
        </div>
        <div>
          <p className="text-slate-500">Throughput</p>
          <p className="font-medium">{formatMetric(run.throughput, "req/s")}</p>
        </div>
        <div>
          <p className="text-slate-500">Errors</p>
          <p className="font-medium">{run.errorRate.toFixed(1)}%</p>
        </div>
      </div>
    </div>
  );
}
