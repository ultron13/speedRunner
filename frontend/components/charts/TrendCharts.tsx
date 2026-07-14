"use client";

import { Activity, ChartNoAxesCombined } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTestStore } from "@/store/test-store";

function formatTime(timestamp: React.ReactNode) {
  if (typeof timestamp !== "string") return "";
  return new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
}

function ChartCard({
  title,
  icon: Icon,
  color,
  dataKey,
  unit,
}: {
  title: string;
  icon: typeof Activity;
  color: string;
  dataKey: "responseTime" | "throughput";
  unit: string;
}) {
  const trendData = useTestStore((state) => state.trendData);

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row items-center gap-2 px-5 py-4">
        <Icon className="size-4 text-slate-500" aria-hidden="true" />
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-64 px-2 pb-4 sm:px-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendData} margin={{ top: 8, right: 14, left: -14, bottom: 0 }}>
            <CartesianGrid stroke="#e7edf1" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} width={42} />
            <Tooltip
              labelFormatter={formatTime}
              formatter={(value) => [`${value ?? 0} ${unit}`, dataKey === "responseTime" ? "Response time" : "Throughput"]}
              contentStyle={{ borderRadius: 8, borderColor: "#dce5eb", fontSize: 12 }}
            />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function TrendCharts() {
  return (
    <section aria-label="Performance trends" className="grid gap-4 xl:grid-cols-2">
      <ChartCard title="Response Time" icon={Activity} color="#209dd7" dataKey="responseTime" unit="ms" />
      <ChartCard title="Throughput" icon={ChartNoAxesCombined} color="#753991" dataKey="throughput" unit="req/s" />
    </section>
  );
}
