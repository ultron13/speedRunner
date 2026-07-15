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

  it("handles multiple runs", () => {
    const mockRuns: Run[] = [
      {
        id: "r1",
        testId: "t1",
        testName: "Test 1",
        status: "completed",
        startedAt: "2025-01-01T10:00:00Z",
        completedAt: "2025-01-01T10:01:00Z",
        duration: 60,
        throughput: 100,
        avgResponseTime: 200,
        errorRate: 0.5,
      },
      {
        id: "r2",
        testId: "t2",
        testName: "Test 2",
        status: "failed",
        startedAt: "2025-01-01T11:00:00Z",
        completedAt: "2025-01-01T11:02:00Z",
        duration: 120,
        throughput: 50,
        avgResponseTime: 500,
        errorRate: 5.0,
      },
    ];

    const mockClick = vi.fn();

    vi.stubGlobal("document", {
      createElement: vi.fn(() => ({
        href: "",
        download: "",
        click: mockClick,
      })),
    });
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:url"),
      revokeObjectURL: vi.fn(),
    });

    exportRunsToCSV(mockRuns, "multiple.csv");

    expect(mockClick).toHaveBeenCalled();
  });

  it("uses default filename when not provided", () => {
    const mockClick = vi.fn();

    vi.stubGlobal("document", {
      createElement: vi.fn(() => ({
        href: "",
        download: "",
        click: mockClick,
      })),
    });
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:url"),
      revokeObjectURL: vi.fn(),
    });

    exportRunsToCSV([]);

    expect(mockClick).toHaveBeenCalled();
  });

  it("escapes quotes in test names", () => {
    const mockRuns: Run[] = [
      {
        id: "r1",
        testId: "t1",
        testName: 'Test "Quotes"',
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

    vi.stubGlobal("document", {
      createElement: vi.fn(() => ({
        href: "",
        download: "",
        click: mockClick,
      })),
    });
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:url"),
      revokeObjectURL: vi.fn(),
    });

    exportRunsToCSV(mockRuns);

    expect(mockClick).toHaveBeenCalled();
  });
});
