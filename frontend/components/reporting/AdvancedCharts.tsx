"use client";

import { useState, useMemo } from "react";
import { BarChart3, Plus, Trash2 } from "lucide-react";
import {
  ScatterChart as RechartsScatterChart,
  Scatter,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useReportingStore } from "@/store/reporting-store";
import { useTestStore } from "@/store/test-store";
import type { ChartType } from "@/types";

const chartTypeLabels: Record<ChartType, string> = {
  line: "Line Chart",
  bar: "Bar Chart",
  area: "Area Chart",
  scatter: "Scatter Plot",
  heatmap: "Heatmap",
  pie: "Pie Chart",
  radar: "Radar Chart",
};

export function AdvancedCharts() {
  const [isCreating, setIsCreating] = useState(false);
  const charts = useReportingStore((state) => state.charts);
  const createChart = useReportingStore((state) => state.createChart);
  const deleteChart = useReportingStore((state) => state.deleteChart);
  const runs = useTestStore((state) => state.runs);

  return (
    <section aria-labelledby="advanced-charts-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="advanced-charts-heading" className="text-base">Advanced Charts</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsCreating(!isCreating)}>
            <Plus className="mr-1 size-4" />
            New Chart
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {isCreating && (
            <ChartForm
              onSubmit={(chart) => {
                createChart(chart);
                setIsCreating(false);
              }}
              onCancel={() => setIsCreating(false)}
            />
          )}

          {charts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
              <BarChart3 className="size-8 text-slate-300" />
              <p className="font-medium text-slate-700">No custom charts</p>
              <p className="text-sm">Create advanced visualizations for your data.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {charts.map((chart) => (
                <AdvancedChartCard
                  key={chart.id}
                  chart={chart}
                  runs={runs}
                  onDelete={() => deleteChart(chart.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function AdvancedChartCard({
  chart,
  runs,
  onDelete,
}: {
  chart: { id: string; name: string; type: ChartType; metrics: string[]; colors: string[] };
  runs: Array<{ testName: string; avgResponseTime: number; throughput: number; errorRate: number; status: string }>;
  onDelete: () => void;
}) {
  const completedRuns = runs.filter((r) => r.status === "completed");

  const scatterData = useMemo(() => {
    if (chart.type !== "scatter") return [];
    return completedRuns.slice(0, 20).map((r) => ({
      x: r.avgResponseTime,
      y: r.throughput,
      name: r.testName,
    }));
  }, [completedRuns, chart.type]);

  const barData = useMemo(() => {
    if (chart.type === "scatter") return [];
    const grouped = new Map<string, number[]>();
    completedRuns.forEach((r) => {
      const existing = grouped.get(r.testName) || [];
      grouped.set(r.testName, [...existing, r.throughput]);
    });
    return Array.from(grouped.entries()).map(([name, values]) => ({
      name: name.length > 15 ? name.slice(0, 15) + "..." : name,
      value: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
    }));
  }, [completedRuns, chart.type]);

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{chart.name}</p>
          <p className="text-xs text-slate-500">{chartTypeLabels[chart.type]}</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onDelete}>
          <Trash2 className="size-4 text-slate-400" />
        </Button>
      </div>
      <div className="h-48">
        {chart.type === "scatter" ? (
          scatterData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              No data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <RechartsScatterChart margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#e7edf1" strokeDasharray="3 3" />
                <XAxis type="number" dataKey="x" name="Response Time" tick={{ fill: "#64748b", fontSize: 10 }} />
                <YAxis type="number" dataKey="y" name="Throughput" tick={{ fill: "#64748b", fontSize: 10 }} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                <Scatter data={scatterData} fill="#209dd7">
                  {scatterData.map((_, index) => (
                    <Cell key={index} fill={chart.colors[index % chart.colors.length]} />
                  ))}
                </Scatter>
              </RechartsScatterChart>
            </ResponsiveContainer>
          )
        ) : barData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="#e7edf1" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#dce5eb", fontSize: 12 }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {barData.map((_, index) => (
                  <Cell key={index} fill={chart.colors[index % chart.colors.length]} />
                ))}
              </Bar>
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
  onSubmit: (chart: Omit<import("@/types").AdvancedChart, "id" | "createdAt">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ChartType>("scatter");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      type,
      dataSource: "runs",
      metrics: ["avgResponseTime", "throughput"],
      colors: ["#209dd7", "#753991", "#ecad0a", "#22c55e"],
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border p-4">
      <div className="grid gap-2">
        <Label htmlFor="chart-name">Chart Name</Label>
        <Input id="chart-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Response vs Throughput" />
      </div>
      <div className="grid gap-2">
        <Label>Chart Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as ChartType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="scatter">Scatter Plot</SelectItem>
            <SelectItem value="bar">Bar Chart</SelectItem>
            <SelectItem value="line">Line Chart</SelectItem>
            <SelectItem value="pie">Pie Chart</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm">Create</Button>
      </div>
    </form>
  );
}
