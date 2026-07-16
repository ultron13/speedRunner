"use client";

import { useEffect, useRef } from "react";

import { apiClient, isGoBackendEnabled } from "@/lib/api-client";
import { useTestStore } from "@/store/test-store";
import type { LiveMetrics, TrendPoint } from "@/types";

/**
 * Polls the Go control plane for live run metrics when API mode is enabled.
 * Updates Zustand liveMetrics + trendData so charts stay in sync with the backend.
 */
export function useApiMetrics(pollMs = 1000) {
  const hydrated = useTestStore((s) => s.hydrated);
  const runningCount = useTestStore(
    (s) => s.tests.filter((t) => t.status === "running").length,
  );
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isGoBackendEnabled() || !hydrated) return;

    const poll = async () => {
      try {
        const res = await apiClient.getLiveMetrics();
        const state = useTestStore.getState();
        const nextMetrics = new Map(state.liveMetrics);

        // Clear metrics for tests that are no longer running
        const runningTestIds = new Set(
          state.tests.filter((t) => t.status === "running").map((t) => t.id),
        );

        // Apply live snapshots keyed by testId
        const seenTests = new Set<string>();
        for (const m of res.metrics || []) {
          if (!m.testId) continue;
          seenTests.add(m.testId);
          const live: LiveMetrics = {
            testId: m.testId,
            duration: m.duration ?? 0,
            throughput: m.throughput ?? 0,
            avgResponseTime: m.avgResponseTime ?? 0,
            errorRate: m.errorRate ?? 0,
            timestamp: Date.now(),
          };
          nextMetrics.set(m.testId, live);
        }

        // Remove stale metrics
        for (const key of nextMetrics.keys()) {
          if (!runningTestIds.has(key) && !seenTests.has(key)) {
            nextMetrics.delete(key);
          }
        }

        // Append trend point when any run is active
        let trendData = state.trendData;
        if ((res.metrics || []).length > 0) {
          const avgRT =
            res.metrics.reduce((a, m) => a + (m.avgResponseTime || 0), 0) /
            res.metrics.length;
          const avgTP =
            res.metrics.reduce((a, m) => a + (m.throughput || 0), 0) /
            res.metrics.length;
          const point: TrendPoint = {
            timestamp: new Date().toISOString(),
            responseTime: Math.round(avgRT * 10) / 10,
            throughput: Math.round(avgTP * 10) / 10,
          };
          trendData = [...state.trendData, point].slice(-30);
        }

        // Detect completed runs: if we had running tests but backend has fewer active,
        // refresh tests + runs
        const localRunning = state.tests.filter((t) => t.status === "running").length;
        if (localRunning > 0 && (res.active ?? 0) < localRunning) {
          try {
            const [testsRes, runsRes] = await Promise.all([
              apiClient.getTests({ limit: 100 }),
              apiClient.getRuns({ limit: 100 }),
            ]);
            useTestStore.getState().applyApiRefresh(testsRes, runsRes);
          } catch {
            // ignore refresh errors mid-poll
          }
        }

        useTestStore.setState({ liveMetrics: nextMetrics, trendData });
      } catch (err) {
        // Quiet — transient network errors are expected during backend restart
        if (process.env.NODE_ENV === "development") {
          console.debug("[useApiMetrics] poll failed", err);
        }
      }
    };

    // Always poll when Go backend is on (detect new runs); faster when active
    const interval = runningCount > 0 ? pollMs : Math.max(pollMs * 3, 3000);
    void poll();
    pollRef.current = window.setInterval(poll, interval);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [hydrated, runningCount, pollMs]);
}
