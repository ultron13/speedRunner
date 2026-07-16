import { parentPort, workerData } from "worker_threads";

export interface LoadGeneratorConfig {
  runId: string;
  testId: string;
  targetUrl: string;
  virtualUsers: number;
  duration: number; // seconds
  rampUpDuration: number; // seconds
  thinkTime: number; // ms between requests per VUser
  method: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: string;
}

export interface MetricSnapshot {
  timestamp: number;
  duration: number;
  throughput: number;
  avgResponseTime: number;
  errorRate: number;
  activeVUsers: number;
  totalRequests: number;
  totalErrors: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

interface RequestContext {
  id: number;
  startTime: number;
  endTime?: number;
  success: boolean;
  statusCode?: number;
  error?: string;
}

class LoadGenerator {
  private config: LoadGeneratorConfig;
  private activeVUsers = 0;
  private totalRequests = 0;
  private totalErrors = 0;
  private responseTimes: number[] = [];
  private isRunning = false;
  private startTime = 0;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(config: LoadGeneratorConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    this.isRunning = true;
    this.startTime = Date.now();

    // Ramp up virtual users gradually
    const rampUpInterval = (this.config.rampUpDuration * 1000) / this.config.virtualUsers;
    let currentVUsers = 0;

    const rampUp = setInterval(() => {
      if (currentVUsers < this.config.virtualUsers && this.isRunning) {
        this.spawnVUser(currentVUsers);
        currentVUsers++;
        this.activeVUsers = currentVUsers;
      } else {
        clearInterval(rampUp);
      }
    }, rampUpInterval);

    // Start metrics collection
    this.intervalId = setInterval(() => {
      this.collectMetrics();
    }, 1000);

    // Stop after duration
    setTimeout(() => {
      this.stop();
    }, this.config.duration * 1000);
  }

  private async spawnVUser(id: number): Promise<void> {
    if (!this.isRunning) return;

    const makeRequest = async (): Promise<void> => {
      if (!this.isRunning) return;

      const context: RequestContext = {
        id,
        startTime: Date.now(),
        success: false,
      };

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(this.config.targetUrl, {
          method: this.config.method,
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "SpeedRunner-LoadTest/1.0",
            ...this.config.headers,
          },
          body: this.config.body,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        context.endTime = Date.now();
        context.success = response.ok;
        context.statusCode = response.status;

        // Consume response body to free up connection
        await response.text();
      } catch (error) {
        context.endTime = Date.now();
        context.success = false;
        context.error = error instanceof Error ? error.message : "Unknown error";
      }

      // Record metrics
      this.totalRequests++;
      if (!context.success) {
        this.totalErrors++;
      }
      if (context.endTime) {
        this.responseTimes.push(context.endTime - context.startTime);
      }

      // Think time before next request
      if (this.isRunning) {
        setTimeout(makeRequest, this.config.thinkTime + Math.random() * 100);
      }
    };

    // Start first request
    makeRequest();
  }

  private collectMetrics(): void {
    const now = Date.now();
    const elapsed = (now - this.startTime) / 1000;

    // Calculate percentiles
    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const len = sorted.length;
    const p50 = len > 0 ? sorted[Math.floor(len * 0.5)] : 0;
    const p90 = len > 0 ? sorted[Math.floor(len * 0.9)] : 0;
    const p95 = len > 0 ? sorted[Math.floor(len * 0.95)] : 0;
    const p99 = len > 0 ? sorted[Math.floor(len * 0.99)] : 0;

    const snapshot: MetricSnapshot = {
      timestamp: now,
      duration: elapsed,
      throughput: elapsed > 0 ? this.totalRequests / elapsed : 0,
      avgResponseTime: len > 0 ? this.responseTimes.reduce((a, b) => a + b, 0) / len : 0,
      errorRate: this.totalRequests > 0 ? (this.totalErrors / this.totalRequests) * 100 : 0,
      activeVUsers: this.activeVUsers,
      totalRequests: this.totalRequests,
      totalErrors: this.totalErrors,
      p50,
      p90,
      p95,
      p99,
    };

    // Send metrics to parent thread
    if (parentPort) {
      parentPort.postMessage({ type: "metrics", data: snapshot });
    }

    // Reset response times for next window (keep last 10s for percentile calculation)
    const cutoff = now - 10000;
    this.responseTimes = this.responseTimes.filter((_, i) => {
      // Approximate: keep ~80% of recent values
      return i > this.responseTimes.length * 0.2;
    });
  }

  stop(): void {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    // Send final metrics
    this.collectMetrics();

    // Send completion signal
    if (parentPort) {
      parentPort.postMessage({
        type: "complete",
        data: {
          totalRequests: this.totalRequests,
          totalErrors: this.totalErrors,
          duration: (Date.now() - this.startTime) / 1000,
        },
      });
    }
  }
}

// Worker thread entry point
if (parentPort && workerData) {
  const config = workerData as LoadGeneratorConfig;
  const generator = new LoadGenerator(config);

  parentPort.on("message", (msg: { type: string }) => {
    if (msg.type === "stop") {
      generator.stop();
    }
  });

  generator.start();
}
