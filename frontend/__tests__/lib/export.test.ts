import { describe, expect, it, vi } from "vitest";

import { exportRunsToCSV } from "@/lib/export";
import type { Run } from "@/types";

describe("exportRunsToCSV", () => {
  it("creates a CSV file with correct headers", () => {
    const mockRuns: Run[] = [
      {
        id: "r1",
        testId: "t1",
        testName: "Test Run 1",
        status: "completed",
        startedAt: "2025-01-01T10:00:00Z",
        completedAt: "2025-01-01T10:01:00Z",
        duration: 60,
        throughput: 100,
        avgResponseTime: 200,
        errorRate: 0.5,
      },
    ];

    const mockClick = vi.fn();
    const mockRevokeObjectURL = vi.fn();
    const mockCreateObjectURL = vi.fn(() => "blob:url");

    vi.stubGlobal("document", {
      createElement: vi.fn(() => ({
        href: "",
        download: "",
        click: mockClick,
      })),
    });
    vi.stubGlobal("URL", {
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL,
    });

    exportRunsToCSV(mockRuns, "test.csv");

    expect(mockClick).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:url");
  });

  it("handles empty runs array", () => {
    const mockClick = vi.fn();
    const mockRevokeObjectURL = vi.fn();

    vi.stubGlobal("document", {
      createElement: vi.fn(() => ({
        href: "",
        download: "",
        click: mockClick,
      })),
    });
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:url"),
      revokeObjectURL: mockRevokeObjectURL,
    });

    exportRunsToCSV([], "empty.csv");

    expect(mockClick).toHaveBeenCalled();
  });
});
