"use client";

import { useEffect } from "react";
import { TrendingUp, TrendingDown, Minus, Zap } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { useAIAnalyticsStore } from "@/store/ai-analytics-store";
import { useTestStore } from "@/store/test-store";

export function PredictiveAnalytics() {
  const predictions = useAIAnalyticsStore((state) => state.predictions);
  const generatePredictions = useAIAnalyticsStore((state) => state.generatePredictions);
  const clearPredictions = useAIAnalyticsStore((state) => state.clearPredictions);
  const trendData = useTestStore((state) => state.trendData);

  // Auto-generate predictions every 60 seconds
  useEffect(() => {
    const generate = () => {
      if (trendData.length >= 3) {
        const responseTimeData = trendData.map((d) => ({
          timestamp: d.timestamp,
          value: d.responseTime,
        }));
        generatePredictions(responseTimeData);
      }
    };

    const interval = setInterval(generate, 60_000);
    generate(); // Initial generation
    return () => clearInterval(interval);
  }, [trendData, generatePredictions]);

  const chartData = trendData.slice(-20).map((d) => ({
    time: new Date(d.timestamp).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" }),
    actual: d.responseTime,
    predicted: predictions[0]?.predictedValue ?? d.responseTime,
  }));

  return (
    <section aria-labelledby="prediction-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="prediction-heading" className="text-base">Predictive Analytics</CardTitle>
          <Button variant="ghost" size="sm" onClick={clearPredictions}>
            Clear
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {predictions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
              <Zap className="size-8 text-slate-300" />
              <p className="font-medium text-slate-700">No predictions yet</p>
              <p className="text-sm">Generate predictions based on historical data.</p>
            </div>
          ) : (
            <>
              {/* Prediction Cards */}
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                {predictions.map((pred) => (
                  <div key={pred.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{pred.metric}</p>
                      <Badge variant="outline">
                        {pred.confidence >= 0.7 ? "High" : "Medium"} confidence
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      {pred.trend === "increasing" ? (
                        <TrendingUp className="size-4 text-rose-500" />
                      ) : pred.trend === "decreasing" ? (
                        <TrendingDown className="size-4 text-emerald-500" />
                      ) : (
                        <Minus className="size-4 text-slate-400" />
                      )}
                      <span className="text-lg font-bold">{pred.predictedValue}</span>
                      <span className="text-xs text-slate-500">({pred.timeframe})</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Current: {pred.currentValue} → Predicted: {pred.predictedValue}
                    </p>
                  </div>
                ))}
              </div>

              {/* Prediction Chart */}
              <div className="h-48">
                <p className="mb-2 text-xs font-medium text-slate-500">Actual vs Predicted</p>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="#e7edf1" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#dce5eb", fontSize: 12 }} />
                    <Line type="monotone" dataKey="actual" stroke="#209dd7" strokeWidth={2} dot={false} name="Actual" />
                    <Line type="monotone" dataKey="predicted" stroke="#753991" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Predicted" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
