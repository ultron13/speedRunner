import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TestActions } from "@/components/tests/TestActions";
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

describe("TestActions", () => {
  it("renders start, stop, and delete buttons", () => {
    resetStore();
    render(<TestActions testId="t1" status="idle" />);
    expect(screen.getByRole("button", { name: /start test/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /stop test/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete test/i })).toBeInTheDocument();
  });

  it("start button is enabled when test is idle", () => {
    resetStore();
    render(<TestActions testId="t1" status="idle" />);
    expect(screen.getByRole("button", { name: /start test/i })).not.toBeDisabled();
  });

  it("start button is disabled when test is running", () => {
    resetStore();
    render(<TestActions testId="t1" status="running" />);
    expect(screen.getByRole("button", { name: /start test/i })).toBeDisabled();
  });

  it("stop button is enabled when test is running", () => {
    resetStore();
    render(<TestActions testId="t1" status="running" />);
    expect(screen.getByRole("button", { name: /stop test/i })).not.toBeDisabled();
  });

  it("stop button is disabled when test is idle", () => {
    resetStore();
    render(<TestActions testId="t1" status="idle" />);
    expect(screen.getByRole("button", { name: /stop test/i })).toBeDisabled();
  });

  it("start button calls startTest action", async () => {
    resetStore();
    useTestStore.setState({
      tests: [
        { id: "t1", name: "Test", description: "", scriptType: "HTTP", targetUrl: "https://a.com", virtualUsers: 100, status: "idle", createdAt: "", lastRunAt: null },
      ],
    });

    const user = userEvent.setup();
    render(<TestActions testId="t1" status="idle" />);
    await user.click(screen.getByRole("button", { name: /start test/i }));

    expect(useTestStore.getState().tests[0].status).toBe("running");
  });

  it("stop button calls stopTest action", async () => {
    resetStore();
    useTestStore.setState({
      tests: [
        { id: "t1", name: "Test", description: "", scriptType: "HTTP", targetUrl: "https://a.com", virtualUsers: 100, status: "running", createdAt: "", lastRunAt: null },
      ],
      liveMetrics: new Map([
        ["t1", { testId: "t1", duration: 10, throughput: 80, avgResponseTime: 200, errorRate: 1, timestamp: Date.now() }],
      ]),
    });

    const user = userEvent.setup();
    render(<TestActions testId="t1" status="running" />);
    await user.click(screen.getByRole("button", { name: /stop test/i }));

    expect(useTestStore.getState().tests[0].status).toBe("stopped");
  });

  it("delete button calls deleteTest action after confirm", async () => {
    resetStore();
    useTestStore.setState({
      tests: [
        { id: "t1", name: "Test", description: "", scriptType: "HTTP", targetUrl: "https://a.com", virtualUsers: 100, status: "idle", createdAt: "", lastRunAt: null },
      ],
    });

    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(<TestActions testId="t1" status="idle" />);
    await user.click(screen.getByRole("button", { name: /delete test/i }));

    expect(useTestStore.getState().tests).toHaveLength(0);
    vi.restoreAllMocks();
  });

  it("delete button does nothing when confirm is cancelled", async () => {
    resetStore();
    useTestStore.setState({
      tests: [
        { id: "t1", name: "Test", description: "", scriptType: "HTTP", targetUrl: "https://a.com", virtualUsers: 100, status: "idle", createdAt: "", lastRunAt: null },
      ],
    });

    vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    render(<TestActions testId="t1" status="idle" />);
    await user.click(screen.getByRole("button", { name: /delete test/i }));

    expect(useTestStore.getState().tests).toHaveLength(1);
    vi.restoreAllMocks();
  });
});
