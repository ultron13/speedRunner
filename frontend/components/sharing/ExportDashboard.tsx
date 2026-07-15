"use client";

import { useState } from "react";
import { Download, FileText, FileSpreadsheet, Code, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useTestStore } from "@/store/test-store";
import { formatDuration, formatMetric } from "@/lib/utils";
import type { ExportFormat } from "@/types";

const formatOptions: { value: ExportFormat; label: string; icon: typeof FileText; description: string }[] = [
  { value: "pdf", label: "PDF Report", icon: FileText, description: "Printable document with charts" },
  { value: "csv", label: "CSV Data", icon: FileSpreadsheet, description: "Spreadsheet-compatible data" },
  { value: "json", label: "JSON Export", icon: Code, description: "Raw data for integrations" },
  { value: "html", label: "HTML Report", icon: FileText, description: "Interactive web report" },
];

export function ExportDashboard() {
  const [isExporting, setIsExporting] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("pdf");
  const [exported, setExported] = useState(false);
  const tests = useTestStore((state) => state.tests);
  const runs = useTestStore((state) => state.runs);
  const getPerformanceStats = useTestStore((state) => state.getPerformanceStats);

  const handleExport = async () => {
    setIsExporting(true);

    // Simulate export delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const stats = getPerformanceStats();
    const completedRuns = runs.filter((r) => r.status === "completed");

    if (selectedFormat === "csv") {
      exportAsCSV(completedRuns);
    } else if (selectedFormat === "json") {
      exportAsJSON(tests, completedRuns, stats);
    } else if (selectedFormat === "html") {
      exportAsHTML(tests, completedRuns, stats);
    } else {
      // PDF - generate HTML and trigger print
      exportAsPDF(tests, completedRuns, stats);
    }

    setIsExporting(false);
    setExported(true);
    setTimeout(() => setExported(false), 3000);
  };

  return (
    <section aria-labelledby="export-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="px-5 py-4">
          <CardTitle id="export-heading" className="text-base">Export Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Export Format</Label>
              <div className="grid grid-cols-2 gap-2">
                {formatOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      onClick={() => setSelectedFormat(option.value)}
                      className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                        selectedFormat === option.value
                          ? "border-sky-500 bg-sky-50 dark:bg-sky-950"
                          : "hover:border-slate-300"
                      }`}
                    >
                      <Icon className={`mt-0.5 size-4 ${selectedFormat === option.value ? "text-sky-600" : "text-slate-400"}`} />
                      <div>
                        <p className="text-sm font-medium">{option.label}</p>
                        <p className="text-xs text-slate-500">{option.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              <div className="text-sm">
                <p className="font-medium">Export Summary</p>
                <p className="text-slate-500">{tests.length} tests, {runs.length} runs</p>
              </div>
              {exported && <Badge className="bg-emerald-100 text-emerald-700">Exported!</Badge>}
            </div>

            <Button onClick={handleExport} disabled={isExporting} className="w-full">
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="mr-2 size-4" />
                  Export {selectedFormat.toUpperCase()}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function exportAsCSV(runs: Array<{ testName: string; status: string; duration: number; throughput: number; avgResponseTime: number; errorRate: number; completedAt: string }>) {
  const headers = ["Test Name", "Status", "Duration (s)", "Throughput (req/s)", "Avg Response Time (ms)", "Error Rate (%)", "Completed At"];
  const rows = runs.map((r) => [
    `"${r.testName.replace(/"/g, '""')}"`,
    r.status,
    r.duration.toString(),
    r.throughput.toString(),
    r.avgResponseTime.toString(),
    r.errorRate.toFixed(2),
    r.completedAt,
  ]);

  const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  downloadFile(csv, "speedrunner-export.csv", "text/csv");
}

function exportAsJSON(tests: Array<{ name: string; status: string; virtualUsers: number; targetUrl: string }>, runs: Array<{ testName: string; status: string; duration: number; throughput: number; avgResponseTime: number; errorRate: number }>, stats: { totalRuns: number; avgResponseTime: number; successRate: number }) {
  const data = {
    exportDate: new Date().toISOString(),
    summary: stats,
    tests,
    runs,
  };

  const json = JSON.stringify(data, null, 2);
  downloadFile(json, "speedrunner-export.json", "application/json");
}

function exportAsHTML(tests: Array<{ name: string; status: string; virtualUsers: number }>, runs: Array<{ testName: string; status: string; duration: number; throughput: number; avgResponseTime: number; errorRate: number }>, stats: { totalRuns: number; avgResponseTime: number; avgThroughput: number; successRate: number }) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>SpeedRunner Enterprise Report</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
    h1 { color: #032147; border-bottom: 2px solid #209dd7; padding-bottom: 10px; }
    .stat { display: inline-block; margin: 10px 20px 10px 0; padding: 15px; background: #f7f8fa; border-radius: 8px; }
    .stat-value { font-size: 24px; font-weight: bold; color: #209dd7; }
    .stat-label { font-size: 12px; color: #64748b; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e7edf1; }
    th { background: #f7f8fa; font-weight: 600; }
  </style>
</head>
<body>
  <h1>SpeedRunner Enterprise Report</h1>
  <p>Generated on ${new Date().toLocaleString()}</p>
  <div class="stat"><div class="stat-value">${stats.totalRuns}</div><div class="stat-label">Total Runs</div></div>
  <div class="stat"><div class="stat-value">${stats.successRate}%</div><div class="stat-label">Success Rate</div></div>
  <div class="stat"><div class="stat-value">${formatMetric(stats.avgResponseTime, "ms")}</div><div class="stat-label">Avg Response</div></div>
  <h2>Recent Runs</h2>
  <table>
    <tr><th>Test</th><th>Duration</th><th>Throughput</th><th>Response</th><th>Errors</th></tr>
    ${runs.slice(0, 10).map((r) => `<tr><td>${r.testName}</td><td>${formatDuration(r.duration)}</td><td>${formatMetric(r.throughput, "req/s")}</td><td>${formatMetric(r.avgResponseTime, "ms")}</td><td>${r.errorRate.toFixed(1)}%</td></tr>`).join("")}
  </table>
</body>
</html>`;

  downloadFile(html, "speedrunner-report.html", "text/html");
}

function exportAsPDF(tests: Array<{ name: string; status: string }>, runs: Array<{ testName: string; duration: number; throughput: number; avgResponseTime: number; errorRate: number }>, stats: { totalRuns: number; successRate: number; avgResponseTime: number }) {
  // For PDF, we'll open a print-friendly version
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>SpeedRunner Enterprise Report</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #032147; }
    .stats { display: flex; gap: 20px; margin: 20px 0; }
    .stat { padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 8px; border: 1px solid #ddd; text-align: left; }
    th { background: #f5f5f5; }
  </style>
</head>
<body>
  <h1>SpeedRunner Enterprise Report</h1>
  <p>Generated: ${new Date().toLocaleString()}</p>
  <div class="stats">
    <div class="stat"><strong>${stats.totalRuns}</strong><br>Total Runs</div>
    <div class="stat"><strong>${stats.successRate}%</strong><br>Success Rate</div>
    <div class="stat"><strong>${stats.avgResponseTime}ms</strong><br>Avg Response</div>
  </div>
  <table>
    <tr><th>Test</th><th>Duration</th><th>Throughput</th><th>Response</th><th>Errors</th></tr>
    ${runs.slice(0, 10).map((r) => `<tr><td>${r.testName}</td><td>${r.duration}s</td><td>${r.throughput} req/s</td><td>${r.avgResponseTime}ms</td><td>${r.errorRate.toFixed(1)}%</td></tr>`).join("")}
  </table>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`);
  printWindow.document.close();
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
