/**
 * Bridge between the load generator manager and the WebSocket broadcast system.
 * This allows real metrics from load tests to be broadcast to connected clients.
 */

import { loadGeneratorManager } from "./load-generator-manager";

type BroadcastFn = (message: Record<string, unknown>) => void;

class WSMetricsBridge {
  private broadcast: BroadcastFn | null = null;
  private static instance: WSMetricsBridge;

  private constructor() {}

  static getInstance(): WSMetricsBridge {
    if (!WSMetricsBridge.instance) {
      WSMetricsBridge.instance = new WSMetricsBridge();
    }
    return WSMetricsBridge.instance;
  }

  setBroadcastFn(fn: BroadcastFn): void {
    this.broadcast = fn;
  }

  async startTestWithBroadcast(
    runId: string,
    testId: string,
    config: {
      targetUrl: string;
      virtualUsers: number;
      duration: number;
      rampUpDuration?: number;
      thinkTime?: number;
      method?: "GET" | "POST" | "PUT" | "DELETE";
      headers?: Record<string, string>;
      body?: string;
    }
  ): Promise<void> {
    await loadGeneratorManager.startTest(
      runId,
      testId,
      config,
      // On metrics
      (metrics) => {
        if (this.broadcast) {
          this.broadcast({
            type: "liveMetrics",
            payload: {
              testId,
              metrics,
            },
          });
        }
      },
      // On complete
      (result) => {
        if (this.broadcast) {
          this.broadcast({
            type: "testComplete",
            payload: {
              testId,
              runId,
              result,
            },
          });
        }
      }
    );
  }

  async stopTest(testId: string): Promise<void> {
    return loadGeneratorManager.stopTest(testId);
  }

  getActiveTestCount(): number {
    return loadGeneratorManager.getActiveTestCount();
  }

  isTestRunning(testId: string): boolean {
    return loadGeneratorManager.isTestRunning(testId);
  }
}

export const wsMetricsBridge = WSMetricsBridge.getInstance();
