"use client";

import { useEffect } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAIAnalyticsStore } from "@/store/ai-analytics-store";
import { useTestStore } from "@/store/test-store";
import type { AnomalySeverity } from "@/types";

const severityConfig: Record<AnomalySeverity, { color: string; bg: string }> = {
  low: { color: "text-sky-600", bg: "bg-sky-50" },
  medium: { color: "text-amber-600", bg: "bg-amber-50" },
  high: { color: "text-orange-600", bg: "bg-orange-50" },
  critical: { color: "text-rose-600", bg: "bg-rose-50" },
};

export function AnomalyDetection() {
  const anomalies = useAIAnalyticsStore((state) => state.anomalies);
  const detectAnomalies = useAIAnalyticsStore((state) => state.detectAnomalies);
  const resolveAnomaly = useAIAnalyticsStore((state) => state.resolveAnomaly);
  const clearAnomalies = useAIAnalyticsStore((state) => state.clearAnomalies);
  const liveMetrics = useTestStore((state) => state.liveMetrics);

  // Auto-detect anomalies every 30 seconds
  useEffect(() => {
    const detect = () => {
      const metricsArray = Array.from(liveMetrics.values()).map((m) => ({
        responseTime: m.avgResponseTime,
        errorRate: m.errorRate,
        throughput: m.throughput,
      }));
      if (metricsArray.length > 0) {
        detectAnomalies(metricsArray);
      }
    };

    const interval = setInterval(detect, 30_000);
    detect(); // Initial detection
    return () => clearInterval(interval);
  }, [liveMetrics, detectAnomalies]);

  const unresolvedCount = anomalies.filter((a) => !a.resolved).length;

  return (
    <section aria-labelledby="anomaly-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <CardTitle id="anomaly-heading" className="text-base">Anomaly Detection</CardTitle>
            {unresolvedCount > 0 && (
              <Badge variant="destructive">{unresolvedCount} detected</Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={clearAnomalies}>
            Clear
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {anomalies.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
              <CheckCircle2 className="size-8 text-emerald-400" />
              <p className="font-medium text-slate-700">No anomalies detected</p>
              <p className="text-sm">All metrics are within normal ranges.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {anomalies.slice(0, 10).map((anomaly) => {
                const config = severityConfig[anomaly.severity];

                return (
                  <div
                    key={anomaly.id}
                    className={`flex items-start justify-between rounded-lg border p-3 ${
                      anomaly.resolved ? "opacity-50" : config.bg
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={`mt-0.5 size-5 ${config.color}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{anomaly.metric}</p>
                          <Badge variant="outline" className={`text-xs ${config.color}`}>
                            {anomaly.severity}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-600">{anomaly.description}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Value: {anomaly.value} | Expected: {anomaly.expectedRange.min}-{anomaly.expectedRange.max}
                        </p>
                        <p className="text-xs text-slate-500">
                          Detected: {new Date(anomaly.detectedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {!anomaly.resolved && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => resolveAnomaly(anomaly.id)}
                      >
                        <CheckCircle2 className="mr-1 size-4" />
                        Resolve
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
