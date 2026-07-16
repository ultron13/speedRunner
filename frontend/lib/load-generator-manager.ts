/**
 * Load Generator Manager
 *
 * This module provides a client-side interface for load generation.
 * Actual test execution is handled by the Go backend which manages
 * Kubernetes JMeter pods.
 */

export interface LoadTestConfig {
  targetUrl: string;
  virtualUsers: number;
  duration: number;
  rampUpDuration?: number;
  thinkTime?: number;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: string;
}

export interface LoadTestMetrics {
  activeVUsers: number;
  throughput: number;
  avgResponseTime: number;
  errorRate: number;
  timestamp: number;
}

export interface LoadTestResult {
  runId: string;
  testId: string;
  status: "completed" | "failed" | "stopped";
  duration: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  throughput: number;
  errorRate: number;
}

class LoadGeneratorManager {
  private activeTests: Map<string, AbortController> = new Map();
  private static instance: LoadGeneratorManager;

  private constructor() {}

  static getInstance(): LoadGeneratorManager {
    if (!LoadGeneratorManager.instance) {
      LoadGeneratorManager.instance = new LoadGeneratorManager();
    }
    return LoadGeneratorManager.instance;
  }

  async startTest(
    runId: string,
    testId: string,
    config: LoadTestConfig,
    onMetrics: (metrics: LoadTestMetrics) => void,
    onComplete: (result: LoadTestResult) => void
  ): Promise<void> {
    if (this.activeTests.has(testId)) {
      throw new Error(`Test ${testId} is already running`);
    }

    const abortController = new AbortController();
    this.activeTests.set(testId, abortController);

    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testId,
          triggerType: "MANUAL",
          config,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to start test: ${response.statusText}`);
      }

      const run = await response.json();
      console.log(`Test ${testId} started with run ID: ${run.id}`);

      this.pollMetrics(runId, testId, onMetrics, onComplete, abortController.signal);
    } catch (error) {
      this.activeTests.delete(testId);
      if ((error as Error).name !== "AbortError") {
        throw error;
      }
    }
  }

  async stopTest(testId: string): Promise<void> {
    const controller = this.activeTests.get(testId);
    if (controller) {
      controller.abort();
      this.activeTests.delete(testId);
    }
  }

  isTestRunning(testId: string): boolean {
    return this.activeTests.has(testId);
  }

  getActiveTestCount(): number {
    return this.activeTests.size;
  }

  private async pollMetrics(
    runId: string,
    testId: string,
    onMetrics: (metrics: LoadTestMetrics) => void,
    onComplete: (result: LoadTestResult) => void,
    signal: AbortSignal
  ): Promise<void> {
    const pollInterval = 1000;

    while (!signal.aborted) {
      try {
        const response = await fetch(`/api/runs/${runId}/metrics`, { signal });
        if (!response.ok) break;

        const metrics = await response.json();
        onMetrics(metrics);

        if (metrics.status === "completed" || metrics.status === "failed") {
          onComplete(metrics);
          this.activeTests.delete(testId);
          break;
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") break;
        console.error("Failed to fetch metrics:", error);
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }
}

export const loadGeneratorManager = LoadGeneratorManager.getInstance();
