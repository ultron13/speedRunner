import type { CreateTestInput, LiveMetrics, TrendPoint } from "@/types";

export interface ServerState {
  tests: Array<{
    id: string;
    name: string;
    description: string;
    scriptType: string;
    targetUrl: string;
    virtualUsers: number;
    status: string;
    createdAt: string;
    lastRunAt: string | null;
  }>;
  runs: Array<{
    id: string;
    testId: string;
    testName: string;
    status: string;
    startedAt: string;
    completedAt: string;
    duration: number;
    throughput: number;
    avgResponseTime: number;
    errorRate: number;
  }>;
  liveMetrics: Record<string, LiveMetrics>;
  trendData: TrendPoint[];
  infrastructure: Array<{
    component: string;
    status: string;
    lastChecked: string;
  }>;
}

export interface TickUpdate {
  liveMetrics: Record<string, LiveMetrics>;
  trendData: TrendPoint[];
}

export type ServerMessage =
  | { type: "snapshot"; payload: ServerState }
  | { type: "tick"; payload: TickUpdate }
  | { type: "connected"; payload: { clientId: string } };

export type ClientMessage =
  | { type: "createTest"; payload: CreateTestInput }
  | { type: "startTest"; payload: { testId: string } }
  | { type: "stopTest"; payload: { testId: string } }
  | { type: "deleteTest"; payload: { testId: string } };
