import { create } from "zustand";

import type {
  AIAnalyticsState,
  AIInsight,
  Anomaly,
  Prediction,
  Recommendation,
} from "@/types";

const ANOMALIES_KEY = "speedrunner-anomalies";
const RECOMMENDATIONS_KEY = "speedrunner-recommendations";

function getStored<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function save<T>(key: string, data: T[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(data.slice(0, 100)));
}

const mockAnomalies: Anomaly[] = [
  {
    id: "anomaly-1",
    metric: "Response Time",
    description: "Response time spiked above 800ms during peak load",
    severity: "high",
    detectedAt: new Date(Date.now() - 3600000).toISOString(),
    value: 850,
    expectedRange: { min: 100, max: 500 },
    resolved: false,
  },
  {
    id: "anomaly-2",
    metric: "Error Rate",
    description: "Error rate exceeded 5% threshold",
    severity: "critical",
    detectedAt: new Date(Date.now() - 7200000).toISOString(),
    value: 7.2,
    expectedRange: { min: 0, max: 2 },
    resolved: true,
  },
];

const mockRecommendations: Recommendation[] = [
  {
    id: "rec-1",
    title: "Increase virtual users for Login test",
    description: "Based on current throughput, increasing virtual users from 500 to 750 would improve test coverage without impacting response times.",
    priority: "medium",
    category: "performance",
    impact: "Improved test coverage by 50%",
    effort: "Low - update test configuration",
    createdAt: new Date().toISOString(),
    applied: false,
  },
  {
    id: "rec-2",
    title: "Enable connection pooling",
    description: "Database connection pooling could reduce average response time by 15-20%.",
    priority: "high",
    category: "reliability",
    impact: "15-20% reduction in response time",
    effort: "Medium - requires configuration change",
    createdAt: new Date().toISOString(),
    applied: false,
  },
];

export interface AIAnalyticsStore extends AIAnalyticsState {
  detectAnomalies: (metrics: { responseTime: number; errorRate: number; throughput: number }[]) => void;
  resolveAnomaly: (id: string) => void;
  clearAnomalies: () => void;

  generatePredictions: (historicalData: { timestamp: string; value: number }[]) => Prediction[];
  clearPredictions: () => void;

  generateRecommendations: (stats: { avgResponseTime: number; errorRate: number; successRate: number }) => void;
  applyRecommendation: (id: string) => void;
  dismissRecommendation: (id: string) => void;
  clearRecommendations: () => void;

  addInsight: (insight: Omit<AIInsight, "id" | "generatedAt">) => void;
  clearInsights: () => void;
}

export const useAIAnalyticsStore = create<AIAnalyticsStore>((set, get) => ({
  anomalies: getStored<Anomaly>(ANOMALIES_KEY).length > 0
    ? getStored<Anomaly>(ANOMALIES_KEY)
    : mockAnomalies,
  predictions: [],
  recommendations: getStored<Recommendation>(RECOMMENDATIONS_KEY).length > 0
    ? getStored<Recommendation>(RECOMMENDATIONS_KEY)
    : mockRecommendations,
  insights: [],

  detectAnomalies: (metrics) => {
    const newAnomalies: Anomaly[] = [];

    metrics.forEach((m) => {
      // Check response time anomaly
      if (m.responseTime > 500) {
        newAnomalies.push({
          id: `anomaly-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          metric: "Response Time",
          description: `Response time of ${m.responseTime}ms exceeds threshold`,
          severity: m.responseTime > 800 ? "critical" : m.responseTime > 600 ? "high" : "medium",
          detectedAt: new Date().toISOString(),
          value: m.responseTime,
          expectedRange: { min: 100, max: 500 },
          resolved: false,
        });
      }

      // Check error rate anomaly
      if (m.errorRate > 2) {
        newAnomalies.push({
          id: `anomaly-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          metric: "Error Rate",
          description: `Error rate of ${m.errorRate}% exceeds threshold`,
          severity: m.errorRate > 5 ? "critical" : m.errorRate > 3 ? "high" : "medium",
          detectedAt: new Date().toISOString(),
          value: m.errorRate,
          expectedRange: { min: 0, max: 2 },
          resolved: false,
        });
      }
    });

    if (newAnomalies.length > 0) {
      const updated = [...newAnomalies, ...get().anomalies].slice(0, 100);
      save(ANOMALIES_KEY, updated);
      set({ anomalies: updated });
    }
  },

  resolveAnomaly: (id) => {
    const updated = get().anomalies.map((a) =>
      a.id === id ? { ...a, resolved: true } : a,
    );
    save(ANOMALIES_KEY, updated);
    set({ anomalies: updated });
  },

  clearAnomalies: () => {
    save(ANOMALIES_KEY, []);
    set({ anomalies: [] });
  },

  generatePredictions: (historicalData) => {
    if (historicalData.length < 3) return [];

    const recent = historicalData.slice(-10);
    const values = recent.map((d) => d.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const trend = values[values.length - 1] - values[0];

    const predictions: Prediction[] = [
      {
        id: `pred-${Date.now()}-1`,
        metric: "Response Time",
        currentValue: values[values.length - 1],
        predictedValue: Math.round(avg + trend * 0.5),
        confidence: 0.75,
        timeframe: "Next 30 minutes",
        trend: trend > 5 ? "increasing" : trend < -5 ? "decreasing" : "stable",
        generatedAt: new Date().toISOString(),
      },
      {
        id: `pred-${Date.now()}-2`,
        metric: "Throughput",
        currentValue: values[values.length - 1],
        predictedValue: Math.round(avg * (1 + trend * 0.001)),
        confidence: 0.65,
        timeframe: "Next 1 hour",
        trend: trend > 2 ? "increasing" : trend < -2 ? "decreasing" : "stable",
        generatedAt: new Date().toISOString(),
      },
    ];

    set({ predictions });
    return predictions;
  },

  clearPredictions: () => {
    set({ predictions: [] });
  },

  generateRecommendations: (stats) => {
    const newRecommendations: Recommendation[] = [];

    if (stats.avgResponseTime > 400) {
      newRecommendations.push({
        id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: "Optimize response time",
        description: `Average response time is ${stats.avgResponseTime}ms. Consider optimizing database queries or adding caching.`,
        priority: "high",
        category: "performance",
        impact: "Reduce response time by 20-30%",
        effort: "Medium - requires code changes",
        createdAt: new Date().toISOString(),
        applied: false,
      });
    }

    if (stats.errorRate > 1) {
      newRecommendations.push({
        id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: "Investigate error rate",
        description: `Error rate is ${stats.errorRate}%. Review error logs and fix underlying issues.`,
        priority: "high",
        category: "reliability",
        impact: "Improve system reliability",
        effort: "Variable - depends on root cause",
        createdAt: new Date().toISOString(),
        applied: false,
      });
    }

    if (stats.successRate < 95) {
      newRecommendations.push({
        id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: "Improve test success rate",
        description: `Success rate is ${stats.successRate}%. Target should be above 95%.`,
        priority: "medium",
        category: "reliability",
        impact: "Increase success rate to >95%",
        effort: "Medium - investigate failures",
        createdAt: new Date().toISOString(),
        applied: false,
      });
    }

    if (newRecommendations.length > 0) {
      const updated = [...newRecommendations, ...get().recommendations].slice(0, 50);
      save(RECOMMENDATIONS_KEY, updated);
      set({ recommendations: updated });
    }
  },

  applyRecommendation: (id) => {
    const updated = get().recommendations.map((r) =>
      r.id === id ? { ...r, applied: true } : r,
    );
    save(RECOMMENDATIONS_KEY, updated);
    set({ recommendations: updated });
  },

  dismissRecommendation: (id) => {
    const updated = get().recommendations.filter((r) => r.id !== id);
    save(RECOMMENDATIONS_KEY, updated);
    set({ recommendations: updated });
  },

  clearRecommendations: () => {
    save(RECOMMENDATIONS_KEY, []);
    set({ recommendations: [] });
  },

  addInsight: (insight) => {
    const newInsight: AIInsight = {
      ...insight,
      id: `insight-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      generatedAt: new Date().toISOString(),
    };
    set((state) => ({
      insights: [newInsight, ...state.insights].slice(0, 50),
    }));
  },

  clearInsights: () => {
    set({ insights: [] });
  },
}));