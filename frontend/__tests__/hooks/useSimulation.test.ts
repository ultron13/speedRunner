import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSimulation } from "@/hooks/useSimulation";
import { useTestStore } from "@/store/test-store";

beforeEach(() => {
  useTestStore.setState({
    hydrated: false,
    tests: [],
    runs: [],
    liveMetrics: new Map(),
    trendData: [],
    infrastructure: [],
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useSimulation", () => {
  it("does not start an interval when no tests are running", () => {
    renderHook(() => useSimulation());
    act(() => vi.advanceTimersByTime(3000));
    expect(useTestStore.getState().trendData).toHaveLength(0);
  });

  it("starts an interval when tests are running", () => {
    useTestStore.setState({
      tests: [{ id: "t1", name: "Test", description: "", scriptType: "HTTP", targetUrl: "https://example.com", virtualUsers: 100, status: "running", createdAt: "", lastRunAt: null }],
    });

    renderHook(() => useSimulation());
    act(() => vi.advanceTimersByTime(3000));

    expect(useTestStore.getState().trendData.length).toBeGreaterThan(0);
  });

  it("clears the interval when all tests stop", () => {
    useTestStore.setState({
      tests: [{ id: "t1", name: "Test", description: "", scriptType: "HTTP", targetUrl: "https://example.com", virtualUsers: 100, status: "running", createdAt: "", lastRunAt: null }],
    });

    const { unmount } = renderHook(() => useSimulation());
    act(() => vi.advanceTimersByTime(2000));
    const countAfterTick = useTestStore.getState().trendData.length;

    unmount();
    act(() => vi.advanceTimersByTime(3000));

    expect(useTestStore.getState().trendData.length).toBe(countAfterTick);
  });
});
