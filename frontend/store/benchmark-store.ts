import { create } from "zustand";

import type { BenchmarkConfig, BenchmarkResult, BenchmarkState } from "@/types";

const CONFIGS_KEY = "speedrunner-benchmark-configs";
const RESULTS_KEY = "speedrunner-benchmark-results";

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
  localStorage.setItem(key, JSON.stringify(data));
}

export interface BenchmarkStore extends BenchmarkState {
  createConfig: (config: Omit<BenchmarkConfig, "id" | "createdAt">) => BenchmarkConfig;
  updateConfig: (id: string, updates: Partial<BenchmarkConfig>) => void;
  deleteConfig: (id: string) => void;
  runBenchmark: (configId: string) => BenchmarkResult;
}

export const useBenchmarkStore = create<BenchmarkStore>((set, get) => ({
  configs: getStored<BenchmarkConfig>(CONFIGS_KEY),
  results: getStored<BenchmarkResult>(RESULTS_KEY),

  createConfig: (config) => {
    const newConfig: BenchmarkConfig = {
      ...config,
      id: `bench-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [...get().configs, newConfig];
    save(CONFIGS_KEY, updated);
    set({ configs: updated });
    return newConfig;
  },

  updateConfig: (id, updates) => {
    const updated = get().configs.map((c) =>
      c.id === id ? { ...c, ...updates } : c,
    );
    save(CONFIGS_KEY, updated);
    set({ configs: updated });
  },

  deleteConfig: (id) => {
    const updated = get().configs.filter((c) => c.id !== id);
    save(CONFIGS_KEY, updated);
    set({ configs: updated });
  },

  runBenchmark: (configId) => {
    const config = get().configs.find((c) => c.id === configId);
    if (!config) throw new Error("Config not found");

    // Simulate benchmark results
    const result: BenchmarkResult = {
      id: `result-${Date.now()}`,
      configId,
      testName: config.name,
      metrics: {
        responseTime: { avg: 180, min: 120, max: 350, p95: 280 },
        throughput: { avg: 450, min: 380, max: 520, p95: 500 },
        errorRate: { avg: 0.5, min: 0, max: 2.1, p95: 1.8 },
      },
      completedAt: new Date().toISOString(),
    };

    const updated = [result, ...get().results].slice(0, 50);
    save(RESULTS_KEY, updated);
    set({ results: updated });
    return result;
  },
}));
