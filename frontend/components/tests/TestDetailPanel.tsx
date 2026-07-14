"use client";

import { X, ExternalLink, Clock, Zap, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration, formatMetric, formatTimestamp } from "@/lib/utils";
import { useTestStore } from "@/store/test-store";
import type { Run } from "@/types";

import { StatusBadge } from "./ActiveTestsTable";

interface TestDetailPanelProps {
  testId: string;
  onClose: () => void;
}

export function TestDetailPanel({ testId, onClose }: TestDetailPanelProps) {
  const test = useTestStore((state) => state.tests.find((t) => t.id === testId));
  const liveMetrics = useTestStore((state) => state.liveMetrics.get(testId));
  const runs = useTestStore(
    useShallow((state) =>
      state.runs
        .filter((r) => r.testId === testId)
        .sort(
          (a, b) =>
            new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
        )
        .slice(0, 5),
    ),
  );

  if (!test) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">{test.name}</h2>
            <StatusBadge status={test.status} />
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="size-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="space-y-6 p-6">
          {/* Test Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <InfoItem label="Description" value={test.description || "No description"} />
            <InfoItem label="Script Type" value={test.scriptType} />
            <InfoItem label="Target URL" value={test.targetUrl} icon={<ExternalLink className="size-3" />} />
            <InfoItem label="Virtual Users" value={test.virtualUsers.toLocaleString()} />
            <InfoItem label="Created" value={formatTimestamp(test.createdAt)} />
            <InfoItem label="Last Run" value={test.lastRunAt ? formatTimestamp(test.lastRunAt) : "Never"} />
          </div>

          {/* Live Metrics (if running) */}
          {test.status === "running" && liveMetrics && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <span className="size-2 animate-pulse rounded-full bg-sky-500" />
                  Live Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <MetricCard
                    icon={<Clock className="size-4 text-sky-600" />}
                    label="Duration"
                    value={formatDuration(liveMetrics.duration)}
                  />
                  <MetricCard
                    icon={<Zap className="size-4 text-violet-600" />}
                    label="Throughput"
                    value={formatMetric(liveMetrics.throughput, "req/s")}
                  />
                  <MetricCard
                    icon={<Clock className="size-4 text-sky-600" />}
                    label="Avg Response"
                    value={formatMetric(liveMetrics.avgResponseTime, "ms")}
                  />
                  <MetricCard
                    icon={<AlertTriangle className="size-4 text-amber-600" />}
                    label="Error Rate"
                    value={`${liveMetrics.errorRate.toFixed(1)}%`}
                  />
                </div>

                {/* Live Metrics Chart */}
                <div className="mt-4 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={[
                        {
                          time: new Date(liveMetrics.timestamp).toLocaleTimeString(),
                          responseTime: liveMetrics.avgResponseTime,
                          throughput: liveMetrics.throughput,
                        },
                      ]}
                    >
                      <CartesianGrid stroke="#e7edf1" strokeDasharray="3 3" />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="responseTime"
                        stroke="#209dd7"
                        strokeWidth={2}
                        dot={false}
                        name="Response Time (ms)"
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="throughput"
                        stroke="#753991"
                        strokeWidth={2}
                        dot={false}
                        name="Throughput (req/s)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Run History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Run History</CardTitle>
            </CardHeader>
            <CardContent>
              {runs.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500">No runs yet</p>
              ) : (
                <div className="space-y-2">
                  {runs.map((run) => (
                    <RunHistoryItem key={run.id} run={run} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="flex items-center gap-1 text-sm font-medium">
        {icon}
        {value}
      </p>
    </div>
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

function RunHistoryItem({ run }: { run: Run }) {
  const statusIcon = {
    completed: <CheckCircle2 className="size-4 text-emerald-500" />,
    stopped: <AlertTriangle className="size-4 text-amber-500" />,
    failed: <AlertTriangle className="size-4 text-rose-500" />,
  };

  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-3">
        {statusIcon[run.status]}
        <div>
          <p className="text-sm font-medium">{formatDuration(run.duration)}</p>
          <p className="text-xs text-slate-500">
            {formatTimestamp(run.completedAt)}
          </p>
        </div>
      </div>
      <div className="flex gap-4 text-sm">
        <span>{formatMetric(run.throughput, "req/s")}</span>
        <span>{formatMetric(run.avgResponseTime, "ms")}</span>
        <span>{run.errorRate.toFixed(1)}%</span>
      </div>
    </div>
  );
}
