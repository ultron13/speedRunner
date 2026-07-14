import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActiveTestsTable } from "@/components/tests/ActiveTestsTable";
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

describe("ActiveTestsTable", () => {
  it("shows empty state when no active tests", () => {
    resetStore();
    render(<ActiveTestsTable />);
    expect(screen.getByText("No active tests")).toBeInTheDocument();
  });

  it("renders active tests (idle and running)", () => {
    resetStore();
    useTestStore.setState({
      tests: [
        { id: "t1", name: "Login Test", description: "Tests login", scriptType: "HTTP", targetUrl: "https://api.example.com/login", virtualUsers: 100, status: "running", createdAt: "", lastRunAt: null },
        { id: "t2", name: "Checkout Test", description: "", scriptType: "JMeter", targetUrl: "https://shop.example.com/checkout", virtualUsers: 500, status: "idle", createdAt: "", lastRunAt: null },
        { id: "t3", name: "Old Test", description: "", scriptType: "HTTP", targetUrl: "https://api.example.com", virtualUsers: 50, status: "completed", createdAt: "", lastRunAt: new Date().toISOString() },
      ],
    });

    render(<ActiveTestsTable />);
    expect(screen.getByText("Login Test")).toBeInTheDocument();
    expect(screen.getByText("Checkout Test")).toBeInTheDocument();
    expect(screen.queryByText("Old Test")).not.toBeInTheDocument();
  });

  it("shows correct status badges", () => {
    resetStore();
    useTestStore.setState({
      tests: [
        { id: "t1", name: "A", description: "", scriptType: "HTTP", targetUrl: "https://a.com", virtualUsers: 100, status: "running", createdAt: "", lastRunAt: null },
        { id: "t2", name: "B", description: "", scriptType: "HTTP", targetUrl: "https://b.com", virtualUsers: 50, status: "idle", createdAt: "", lastRunAt: null },
      ],
    });

    render(<ActiveTestsTable />);
    expect(screen.getAllByText("running")).toHaveLength(1);
    expect(screen.getAllByText("idle")).toHaveLength(1);
  });

  it("start button is disabled for running tests", () => {
    resetStore();
    useTestStore.setState({
      tests: [
        { id: "t1", name: "A", description: "", scriptType: "HTTP", targetUrl: "https://a.com", virtualUsers: 100, status: "running", createdAt: "", lastRunAt: null },
      ],
    });

    render(<ActiveTestsTable />);
    const startBtn = screen.getByRole("button", { name: /start test/i });
    expect(startBtn).toBeDisabled();
  });

  it("stop button is disabled for non-running tests", () => {
    resetStore();
    useTestStore.setState({
      tests: [
        { id: "t1", name: "A", description: "", scriptType: "HTTP", targetUrl: "https://a.com", virtualUsers: 100, status: "idle", createdAt: "", lastRunAt: null },
      ],
    });

    render(<ActiveTestsTable />);
    const stopBtn = screen.getByRole("button", { name: /stop test/i });
    expect(stopBtn).toBeDisabled();
  });
});
