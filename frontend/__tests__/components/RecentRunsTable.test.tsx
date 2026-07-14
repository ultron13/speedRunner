import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RecentRunsTable } from "@/components/tests/RecentRunsTable";
import { useTestStore } from "@/store/test-store";

function resetStore() {
  useTestStore.setState({
    hydrated: false,
    tests: [],
    runs: [],
    liveMetrics: new Map(),
    trendData: [],
    infrastructure: [],
  });
}

describe("RecentRunsTable", () => {
  it("shows empty state when no runs", () => {
    resetStore();
    render(<RecentRunsTable />);
    expect(screen.getByText("No runs yet")).toBeInTheDocument();
  });

  it("renders recent runs sorted by newest first", () => {
    resetStore();
    useTestStore.setState({
      runs: [
        { id: "r1", testId: "t1", testName: "Old Run", status: "completed", startedAt: "2025-01-01T10:00:00Z", completedAt: "2025-01-01T10:01:00Z", duration: 60, throughput: 100, avgResponseTime: 200, errorRate: 0.5 },
        { id: "r2", testId: "t2", testName: "New Run", status: "stopped", startedAt: "2025-01-02T10:00:00Z", completedAt: "2025-01-02T10:02:00Z", duration: 120, throughput: 50, avgResponseTime: 300, errorRate: 1.2 },
      ],
    });

    render(<RecentRunsTable />);
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("New Run");
    expect(rows[2]).toHaveTextContent("Old Run");
  });

  it("shows at most 20 runs", () => {
    resetStore();
    const runs = Array.from({ length: 25 }, (_, i) => ({
      id: `r${i}`,
      testId: `t${i}`,
      testName: `Run ${i}`,
      status: "completed" as const,
      startedAt: new Date(Date.now() - i * 60000).toISOString(),
      completedAt: new Date(Date.now() - i * 60000 + 30000).toISOString(),
      duration: 30,
      throughput: 100,
      avgResponseTime: 200,
      errorRate: 0.1,
    }));

    useTestStore.setState({ runs });
    render(<RecentRunsTable />);
    const rows = screen.getAllByRole("row");
    expect(rows.length).toBe(21); // 1 header + 20 data rows
  });
});
