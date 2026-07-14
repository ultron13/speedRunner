"use client";

import { useState } from "react";
import { GitCompareArrows, TrendingUp, TrendingDown, Minus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTestStore } from "@/store/test-store";
import { formatMetric } from "@/lib/utils";
import type { ComparisonPeriod, ComparisonResult, Run } from "@/types";

export function ComparisonTool() {
  const [period1, setPeriod1] = useState<ComparisonPeriod>({
    id: "p1",
    label: "Period 1",
    startDate: "",
    endDate: "",
  });
  const [period2, setPeriod2] = useState<ComparisonPeriod>({
    id: "p2",
    label: "Period 2",
    startDate: "",
    endDate: "",
  });
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const runs = useTestStore((state) => state.runs);

  const comparePeriods = () => {
    if (!period1.startDate || !period1.endDate || !period2.startDate || !period2.endDate) return;

    const filterRuns = (start: string, end: string) => {
      const startDate = new Date(start);
      const endDate = new Date(end);
      return runs.filter((r) => {
        const runDate = new Date(r.completedAt);
        return runDate >= startDate && runDate <= endDate;
      });
    };

    const runs1 = filterRuns(period1.startDate, period1.endDate);
    const runs2 = filterRuns(period2.startDate, period2.endDate);

    const calcStats = (r: Run[]) => {
      const completed = r.filter((run) => run.status === "completed");
      if (completed.length === 0) {
        return { avgResponseTime: 0, throughput: 0, errorRate: 0, totalRuns: r.length, successRate: 0 };
      }
      return {
        avgResponseTime: Math.round(completed.reduce((sum, run) => sum + run.avgResponseTime, 0) / completed.length),
        throughput: Math.round(completed.reduce((sum, run) => sum + run.throughput, 0) / completed.length),
        errorRate: Number((completed.reduce((sum, run) => sum + run.errorRate, 0) / completed.length).toFixed(2)),
        totalRuns: r.length,
        successRate: Math.round((completed.length / r.length) * 100),
      };
    };

    const stats1 = calcStats(runs1);
    const stats2 = calcStats(runs2);

    setResult({
      period1: { ...stats1, label: period1.label },
      period2: { ...stats2, label: period2.label },
      differences: {
        responseTime: stats2.avgResponseTime - stats1.avgResponseTime,
        throughput: stats2.throughput - stats1.throughput,
        errorRate: Number((stats2.errorRate - stats1.errorRate).toFixed(2)),
        totalRuns: stats2.totalRuns - stats1.totalRuns,
        successRate: stats2.successRate - stats1.successRate,
      },
    });
  };

  return (
    <section aria-labelledby="comparison-tool-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="px-5 py-4">
          <CardTitle id="comparison-tool-heading" className="text-base">Period Comparison</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-sky-600">Period 1</Label>
              <Input
                type="date"
                value={period1.startDate}
                onChange={(e) => setPeriod1((p) => ({ ...p, startDate: e.target.value }))}
              />
              <Input
                type="date"
                value={period1.endDate}
                onChange={(e) => setPeriod1((p) => ({ ...p, endDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-violet-600">Period 2</Label>
              <Input
                type="date"
                value={period2.startDate}
                onChange={(e) => setPeriod2((p) => ({ ...p, startDate: e.target.value }))}
              />
              <Input
                type="date"
                value={period2.endDate}
                onChange={(e) => setPeriod2((p) => ({ ...p, endDate: e.target.value }))}
              />
            </div>
          </div>

          <Button onClick={comparePeriods} className="w-full" disabled={!period1.startDate || !period1.endDate || !period2.startDate || !period2.endDate}>
            <GitCompareArrows className="mr-2 size-4" />
            Compare Periods
          </Button>

          {result && <ComparisonResultCard result={result} />}
        </CardContent>
      </Card>
    </section>
  );
}

function ComparisonResultCard({ result }: { result: ComparisonResult }) {
  const metrics = [
    {
      label: "Avg Response Time",
      period1: formatMetric(result.period1.avgResponseTime, "ms"),
      period2: formatMetric(result.period2.avgResponseTime, "ms"),
      diff: result.differences.responseTime,
      unit: "ms",
      lowerIsBetter: true,
    },
    {
      label: "Avg Throughput",
      period1: formatMetric(result.period1.throughput, "req/s"),
      period2: formatMetric(result.period2.throughput, "req/s"),
      diff: result.differences.throughput,
      unit: "req/s",
      lowerIsBetter: false,
    },
    {
      label: "Avg Error Rate",
      period1: `${result.period1.errorRate}%`,
      period2: `${result.period2.errorRate}%`,
      diff: result.differences.errorRate,
      unit: "%",
      lowerIsBetter: true,
    },
    {
      label: "Total Runs",
      period1: String(result.period1.totalRuns),
      period2: String(result.period2.totalRuns),
      diff: result.differences.totalRuns,
      unit: "",
      lowerIsBetter: false,
    },
    {
      label: "Success Rate",
      period1: `${result.period1.successRate}%`,
      period2: `${result.period2.successRate}%`,
      diff: result.differences.successRate,
      unit: "%",
      lowerIsBetter: false,
    },
  ];

  return (
    <div className="mt-4 space-y-3">
      <h4 className="text-sm font-medium">Results</h4>
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Metric</th>
              <th className="px-4 py-2 text-right font-medium text-sky-600">Period 1</th>
              <th className="px-4 py-2 text-right font-medium text-violet-600">Period 2</th>
              <th className="px-4 py-2 text-right font-medium">Change</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => {
              const isPositive = m.lowerIsBetter ? m.diff < 0 : m.diff > 0;
              const isNegative = m.lowerIsBetter ? m.diff > 0 : m.diff < 0;
              return (
                <tr key={m.label} className="border-t">
                  <td className="px-4 py-2 font-medium">{m.label}</td>
                  <td className="px-4 py-2 text-right">{m.period1}</td>
                  <td className="px-4 py-2 text-right">{m.period2}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={`inline-flex items-center gap-1 ${
                      isPositive ? "text-emerald-600" : isNegative ? "text-rose-600" : "text-slate-500"
                    }`}>
                      {isPositive ? <TrendingUp className="size-3" /> : isNegative ? <TrendingDown className="size-3" /> : <Minus className="size-3" />}
                      {m.diff > 0 ? "+" : ""}{m.unit ? `${m.diff} ${m.unit}` : m.diff}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
