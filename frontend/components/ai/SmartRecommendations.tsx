"use client";

import { useEffect } from "react";
import { Lightbulb, CheckCircle2, X, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAIAnalyticsStore } from "@/store/ai-analytics-store";
import { useTestStore } from "@/store/test-store";
import type { RecommendationPriority } from "@/types";

const priorityConfig: Record<RecommendationPriority, { color: string; bg: string }> = {
  low: { color: "text-sky-600", bg: "bg-sky-50" },
  medium: { color: "text-amber-600", bg: "bg-amber-50" },
  high: { color: "text-rose-600", bg: "bg-rose-50" },
};

export function SmartRecommendations() {
  const recommendations = useAIAnalyticsStore((state) => state.recommendations);
  const generateRecommendations = useAIAnalyticsStore((state) => state.generateRecommendations);
  const applyRecommendation = useAIAnalyticsStore((state) => state.applyRecommendation);
  const dismissRecommendation = useAIAnalyticsStore((state) => state.dismissRecommendation);
  const getPerformanceStats = useTestStore((state) => state.getPerformanceStats);
  const runs = useTestStore((state) => state.runs);

  // Auto-generate recommendations every 2 minutes
  useEffect(() => {
    const generate = () => {
      const stats = getPerformanceStats();
      generateRecommendations({
        avgResponseTime: stats.avgResponseTime,
        errorRate: stats.avgErrorRate,
        successRate: stats.successRate,
      });
    };

    const interval = setInterval(generate, 120_000);
    return () => clearInterval(interval);
  }, [runs, getPerformanceStats, generateRecommendations]);

  const activeRecommendations = recommendations.filter((r) => !r.applied);

  return (
    <section aria-labelledby="recommendations-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="recommendations-heading" className="text-base flex items-center gap-2">
            <Sparkles className="size-4" />
            Smart Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {activeRecommendations.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
              <Lightbulb className="size-8 text-slate-300" />
              <p className="font-medium text-slate-700">No recommendations</p>
              <p className="text-sm">AI will analyze your data and suggest improvements.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeRecommendations.slice(0, 5).map((rec) => {
                const config = priorityConfig[rec.priority];

                return (
                  <div key={rec.id} className={`rounded-lg border p-3 ${config.bg}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{rec.title}</p>
                          <Badge variant="outline" className={`text-xs ${config.color}`}>
                            {rec.priority}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {rec.category}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">{rec.description}</p>
                        <div className="mt-2 flex gap-4 text-xs text-slate-500">
                          <span>Impact: {rec.impact}</span>
                          <span>Effort: {rec.effort}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => applyRecommendation(rec.id)}
                        >
                          <CheckCircle2 className="mr-1 size-4 text-emerald-600" />
                          Apply
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => dismissRecommendation(rec.id)}
                        >
                          <X className="size-4 text-slate-400" />
                        </Button>
                      </div>
                    </div>
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
