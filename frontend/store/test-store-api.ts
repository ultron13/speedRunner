/**
 * API integration for the test store.
 * Provides async actions that fetch from the REST API.
 */

import { apiClient } from "@/lib/api-client";
import { useTestStore } from "./test-store";

export async function fetchTestsFromAPI() {
  try {
    const response = await apiClient.getTests({ limit: 100 });
    const tests = response.tests.map((t) => ({
      id: t.id as string,
      name: t.name as string,
      description: (t.description as string) || "",
      scriptType: t.scriptType as "HTTP" | "TruClient" | "JMeter",
      targetUrl: t.targetUrl as string,
      virtualUsers: t.virtualUsers as number,
      status: (t.status as string).toLowerCase() as "idle" | "running" | "completed" | "stopped" | "failed",
      createdAt: t.createdAt as string,
      lastRunAt: (t.lastRunAt as string) || null,
    }));

    useTestStore.setState({ tests });
    return tests;
  } catch (error) {
    console.error("Failed to fetch tests from API:", error);
    return null;
  }
}

export async function fetchRunsFromAPI(testId?: string) {
  try {
    const response = await apiClient.getRuns({ testId, limit: 100 });
    const runs = response.runs.map((r) => ({
      id: r.id as string,
      testId: r.testId as string,
      testName: (r.test as Record<string, unknown>)?.name as string || "Unknown",
      status: (r.status as string).toLowerCase() as "completed" | "stopped" | "failed",
      startedAt: r.startedAt as string,
      completedAt: (r.completedAt as string) || new Date().toISOString(),
      duration: (r.duration as number) || 0,
      throughput: (r.throughput as number) || 0,
      avgResponseTime: (r.avgResponseTime as number) || 0,
      errorRate: (r.errorRate as number) || 0,
    }));

    useTestStore.setState({ runs });
    return runs;
  } catch (error) {
    console.error("Failed to fetch runs from API:", error);
    return null;
  }
}

export async function createTestViaAPI(data: {
  name: string;
  description?: string;
  scriptType: string;
  targetUrl: string;
  virtualUsers: number;
}) {
  try {
    const test = await apiClient.createTest(data);
    
    // Update local store
    useTestStore.setState((state) => ({
      tests: [
        ...state.tests,
        {
          id: test.id as string,
          name: test.name as string,
          description: (test.description as string) || "",
          scriptType: test.scriptType as "HTTP" | "TruClient" | "JMeter",
          targetUrl: test.targetUrl as string,
          virtualUsers: test.virtualUsers as number,
          status: "idle" as const,
          createdAt: test.createdAt as string,
          lastRunAt: null,
        },
      ],
    }));

    return test;
  } catch (error) {
    console.error("Failed to create test via API:", error);
    throw error;
  }
}

export async function startTestViaAPI(testId: string, config?: {
  duration?: number;
  rampUpDuration?: number;
  thinkTime?: number;
  method?: string;
}) {
  try {
    const run = await apiClient.startTest(testId, config);
    
    // Update local store
    useTestStore.setState((state) => ({
      tests: state.tests.map((t) =>
        t.id === testId ? { ...t, status: "running" as const } : t
      ),
    }));

    return run;
  } catch (error) {
    console.error("Failed to start test via API:", error);
    throw error;
  }
}

export async function stopTestViaAPI(testId: string) {
  try {
    await apiClient.stopTest(testId);
    
    // Update local store
    useTestStore.setState((state) => ({
      tests: state.tests.map((t) =>
        t.id === testId ? { ...t, status: "stopped" as const } : t
      ),
    }));

    return true;
  } catch (error) {
    console.error("Failed to stop test via API:", error);
    throw error;
  }
}
