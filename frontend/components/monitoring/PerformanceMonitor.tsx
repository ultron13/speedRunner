"use client";

import { useEffect, useState } from "react";
import { Gauge, Clock, Cpu, Wifi } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMonitoringStore } from "@/store/monitoring-store";

export function PerformanceMonitor() {
  const perfMetrics = useMonitoringStore((state) => state.performance);
  const addMetric = useMonitoringStore((state) => state.addPerformanceMetric);
  const [networkLatency, setNetworkLatency] = useState(35);
  const [cpuUsage, setCpuUsage] = useState(25);

  // Simulate performance metrics
  useEffect(() => {
    const measurePerformance = () => {
      const start = window.performance.now();
      requestAnimationFrame(() => {
        const end = window.performance.now();

        addMetric({
          name: "Render Time",
          value: Math.round(end - start),
          unit: "ms",
          category: "render",
        });

        addMetric({
          name: "Memory Usage",
          value: Math.round(Math.random() * 50 + 100),
          unit: "MB",
          category: "memory",
        });

        setNetworkLatency(Math.round(Math.random() * 20 + 30));
        setCpuUsage(Math.round(Math.random() * 30 + 20));
      });
    };

    const interval = setInterval(measurePerformance, 5_000);
    measurePerformance(); // Initial measurement
    return () => clearInterval(interval);
  }, [addMetric]);

  const chartData = perfMetrics
    .filter((m) => m.category === "render")
    .slice(-20)
    .map((m) => ({
      time: new Date(m.timestamp).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }),
      value: m.value,
    }));

  const memoryData = perfMetrics
    .filter((m) => m.category === "memory")
    .slice(-20)
    .map((m) => ({
      time: new Date(m.timestamp).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }),
      value: m.value,
    }));

  const latestMetrics = {
    renderTime: perfMetrics.filter((m) => m.category === "render").at(-1)?.value ?? 0,
    memory: perfMetrics.filter((m) => m.category === "memory").at(-1)?.value ?? 0,
    networkLatency,
    cpuUsage,
  };

  return (
    <section aria-labelledby="performance-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="px-5 py-4">
          <CardTitle id="performance-heading" className="text-base">Performance Monitor</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {/* Metric Cards */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard
              icon={<Clock className="size-4 text-sky-600" />}
              label="Render Time"
              value={`${latestMetrics.renderTime}ms`}
            />
            <MetricCard
              icon={<Gauge className="size-4 text-violet-600" />}
              label="Memory"
              value={`${latestMetrics.memory}MB`}
            />
            <MetricCard
              icon={<Wifi className="size-4 text-emerald-600" />}
              label="Latency"
              value={`${latestMetrics.networkLatency}ms`}
            />
            <MetricCard
              icon={<Cpu className="size-4 text-amber-600" />}
              label="CPU"
              value={`${latestMetrics.cpuUsage}%`}
            />
          </div>

          {/* Charts */}
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="h-40">
              <p className="mb-2 text-xs font-medium text-slate-500">Render Time (ms)</p>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#e7edf1" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 9 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#dce5eb", fontSize: 11 }} />
                  <Line type="monotone" dataKey="value" stroke="#209dd7" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="h-40">
              <p className="mb-2 text-xs font-medium text-slate-500">Memory Usage (MB)</p>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={memoryData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#e7edf1" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 9 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#dce5eb", fontSize: 11 }} />
                  <Line type="monotone" dataKey="value" stroke="#753991" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
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
