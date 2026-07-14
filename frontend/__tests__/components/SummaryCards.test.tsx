import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SummaryCards } from "@/components/dashboard/SummaryCards";
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

describe("SummaryCards", () => {
  it("renders all four summary labels", () => {
    resetStore();
    render(<SummaryCards />);
    expect(screen.getByText("Total Tests")).toBeInTheDocument();
    expect(screen.getByText("Running Tests")).toBeInTheDocument();
    expect(screen.getByText("Completed Runs")).toBeInTheDocument();
    expect(screen.getByText("Avg Response Time")).toBeInTheDocument();
  });

  it("shows zero values when store is empty", () => {
    resetStore();
    render(<SummaryCards />);
    expect(screen.getByText("Total Tests").closest("div")!.parentElement!.parentElement!).toHaveTextContent("0");
  });

  it("reflects store values after hydration", () => {
    resetStore();
    useTestStore.setState({
      tests: [
        { id: "t1", name: "A", description: "", scriptType: "HTTP", targetUrl: "https://a.com", virtualUsers: 100, status: "running", createdAt: "", lastRunAt: null },
        { id: "t2", name: "B", description: "", scriptType: "HTTP", targetUrl: "https://b.com", virtualUsers: 50, status: "idle", createdAt: "", lastRunAt: null },
      ],
      runs: [
        { id: "r1", testId: "t1", testName: "A", status: "completed", startedAt: "", completedAt: new Date().toISOString(), duration: 60, throughput: 100, avgResponseTime: 250, errorRate: 1.2 },
      ],
    });

    render(<SummaryCards />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(2);
  });
});
