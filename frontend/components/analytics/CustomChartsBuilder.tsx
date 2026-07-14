"use client";

import { useState, useMemo } from "react";
import { Plus, Trash2, BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTestStore } from "@/store/test-store";
import type { ChartMetric, CustomChart, Run } from "@/types";

const metricLabels: Record<ChartMetric, string> = {
  avgResponseTime: "Avg Response Time",
  throughput: "Throughput",
  errorRate: "Error Rate",
  duration: "Duration",
  virtualUsers: "Virtual Users",
};

const metricUnits: Record<ChartMetric, string> = {
  avgResponseTime: "ms",
  throughput: "req/s",
  errorRate: "%",
  duration: "s",
  virtualUsers: "",
};

const chartColors = ["#209dd7", "#753991", "#ecad0a", "#22c55e", "#ef4444", "#8b5cf6"];

const aggregationLabels = {
  avg: "Average",
  min: "Minimum",
  max: "Maximum",
  sum: "Sum",
  count: "Count",
};

const groupByLabels = {
  test: "Test Name",
  status: "Status",
  scriptType: "Script Type",
  day: "Day",
  hour: "Hour",
};

export function CustomChartsBuilder() {
  const [charts, setCharts] = useState<CustomChart[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const runs = useTestStore((state) => state.runs);

  const addChart = (chart: Omit<CustomChart, "id" | "createdAt">) => {
    setCharts((prev) => [
      ...prev,
      { ...chart, id: `chart-${Date.now()}`, createdAt: new Date().toISOString() },
    ]);
    setIsCreating(false);
  };

  const removeChart = (id: string) => {
    setCharts((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <section aria-labelledby="custom-charts-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="custom-charts-heading" className="text-base">Custom Charts</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsCreating(!isCreating)}>
            <Plus className="mr-1 size-4" />
            Add Chart
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {isCreating && (
            <ChartForm onSubmit={addChart} onCancel={() => setIsCreating(false)} />
          )}

          {charts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
              <BarChart3 className="size-8 text-slate-300" />
              <p className="font-medium text-slate-700">No custom charts</p>
              <p className="text-sm">Create custom charts to visualize specific metrics.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {charts.map((chart, index) => (
                <CustomChartCard
                  key={chart.id}
                  chart={chart}
                  runs={runs}
                  color={chartColors[index % chartColors.length]}
                  onRemove={() => removeChart(chart.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function CustomChartCard({
  chart,
  runs,
  color,
  onRemove,
}: {
  chart: CustomChart;
  runs: Run[];
  color: string;
  onRemove: () => void;
}) {
  const chartData = useMemo(() => {
    const completedRuns = runs.filter((r) => r.status === "completed");
    if (completedRuns.length === 0) return [];

    // Group runs
    const groups = new Map<string, Run[]>();
    completedRuns.forEach((run) => {
      let key: string;
      switch (chart.groupBy) {
        case "test":
          key = run.testName;
          break;
        case "status":
          key = run.status;
          break;
        case "scriptType":
          key = "HTTP"; // Default since Run doesn't have scriptType
          break;
        case "day":
          key = new Date(run.completedAt).toLocaleDateString("en", { month: "short", day: "numeric" });
          break;
        case "hour":
          key = new Date(run.completedAt).toLocaleTimeString("en", { hour: "2-digit" });
          break;
        default:
          key = run.testName;
      }
      const existing = groups.get(key) || [];
      groups.set(key, [...existing, run]);
    });

    // Aggregate
    return Array.from(groups.entries()).map(([name, groupRuns]) => {
      const values = groupRuns.map((r) => r[chart.metric as keyof Run] as number);
      let aggregated: number;
      switch (chart.aggregation) {
        case "avg":
          aggregated = values.reduce((a, b) => a + b, 0) / values.length;
          break;
        case "min":
          aggregated = Math.min(...values);
          break;
        case "max":
          aggregated = Math.max(...values);
          break;
        case "sum":
          aggregated = values.reduce((a, b) => a + b, 0);
          break;
        case "count":
          aggregated = values.length;
          break;
        default:
          aggregated = values.reduce((a, b) => a + b, 0) / values.length;
      }
      return {
        name: name.length > 15 ? name.slice(0, 15) + "..." : name,
        value: Math.round(aggregated * 100) / 100,
      };
    });
  }, [runs, chart]);

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{chart.name}</p>
          <p className="text-xs text-slate-500">
            {metricLabels[chart.metric]} · {aggregationLabels[chart.aggregation]} · by {groupByLabels[chart.groupBy]}
          </p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onRemove}>
          <Trash2 className="size-4 text-slate-400" />
        </Button>
      </div>
      <div className="h-48">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="#e7edf1" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, borderColor: "#dce5eb", fontSize: 12 }}
                formatter={(value) => [`${value} ${metricUnits[chart.metric]}`, chart.name]}
              />
              <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function ChartForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (chart: Omit<CustomChart, "id" | "createdAt">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [metric, setMetric] = useState<ChartMetric>("avgResponseTime");
  const [aggregation, setAggregation] = useState<CustomChart["aggregation"]>("avg");
  const [groupBy, setGroupBy] = useState<CustomChart["groupBy"]>("test");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      metric,
      aggregation,
      groupBy,
      color: chartColors[Math.floor(Math.random() * chartColors.length)],
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border p-4">
      <div className="grid gap-2">
        <Label htmlFor="chart-name">Chart Name</Label>
        <Input
          id="chart-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Response Time by Test"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="grid gap-2">
          <Label>Metric</Label>
          <Select value={metric} onValueChange={(v) => setMetric(v as ChartMetric)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(metricLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Aggregation</Label>
          <Select value={aggregation} onValueChange={(v) => setAggregation(v as CustomChart["aggregation"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(aggregationLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Group By</Label>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as CustomChart["groupBy"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(groupByLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm">Create Chart</Button>
      </div>
    </form>
  );
}
