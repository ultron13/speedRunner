import type { Run } from "@/types";

export function exportRunsToCSV(runs: Run[], filename = "test-runs.csv") {
  const headers = [
    "Test Name",
    "Status",
    "Started At",
    "Completed At",
    "Duration (s)",
    "Throughput (req/s)",
    "Avg Response Time (ms)",
    "Error Rate (%)",
  ];

  const rows = runs.map((run) => [
    `"${run.testName.replace(/"/g, '""')}"`,
    run.status,
    run.startedAt,
    run.completedAt,
    run.duration.toString(),
    run.throughput.toString(),
    run.avgResponseTime.toString(),
    run.errorRate.toFixed(2),
  ]);

  const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function formatDateForCSV(date: string) {
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
