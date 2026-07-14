"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTestStore } from "@/store/test-store";
import { formatDuration, formatMetric } from "@/lib/utils";

export function ReportGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportType, setReportType] = useState<"summary" | "detailed" | "sla">("summary");
  const tests = useTestStore((state) => state.tests);
  const runs = useTestStore((state) => state.runs);
  const slaThresholds = useTestStore((state) => state.slaThresholds);
  const getPerformanceStats = useTestStore((state) => state.getPerformanceStats);

  const generateReport = () => {
    setIsGenerating(true);

    // Simulate report generation
    setTimeout(() => {
      const stats = getPerformanceStats();
      const completedRuns = runs.filter((r) => r.status === "completed");

      let reportContent = "";

      if (reportType === "summary") {
        reportContent = generateSummaryReport(tests, completedRuns, stats);
      } else if (reportType === "detailed") {
        reportContent = generateDetailedReport(tests, completedRuns, stats);
      } else {
        reportContent = generateSLAReport(tests, completedRuns, stats, slaThresholds);
      }

      // Create and download the report
      const blob = new Blob([reportContent], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `speedrunner-report-${reportType}-${new Date().toISOString().split("T")[0]}.html`;
      link.click();
      URL.revokeObjectURL(url);

      setIsGenerating(false);
    }, 1000);
  };

  return (
    <section aria-labelledby="report-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="report-heading" className="text-base">Generate Report</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Report Type</Label>
              <Select value={reportType} onValueChange={(v) => setReportType(v as typeof reportType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">Summary Report</SelectItem>
                  <SelectItem value="detailed">Detailed Report</SelectItem>
                  <SelectItem value="sla">SLA Compliance Report</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={generateReport} disabled={isGenerating} className="w-full">
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="mr-2 size-4" />
                  Download Report
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function generateSummaryReport(
  tests: Array<{ name: string; status: string; virtualUsers: number }>,
  runs: Array<{ testName: string; duration: number; throughput: number; avgResponseTime: number; errorRate: number; status: string }>,
  stats: { totalRuns: number; avgResponseTime: number; avgThroughput: number; successRate: number }
): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>SpeedRunner Summary Report</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
    h1 { color: #032147; border-bottom: 2px solid #209dd7; padding-bottom: 10px; }
    h2 { color: #032147; margin-top: 30px; }
    .stat { display: inline-block; margin: 10px 20px 10px 0; padding: 15px; background: #f7f8fa; border-radius: 8px; }
    .stat-value { font-size: 24px; font-weight: bold; color: #209dd7; }
    .stat-label { font-size: 12px; color: #64748b; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e7edf1; }
    th { background: #f7f8fa; font-weight: 600; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e7edf1; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <h1>SpeedRunner Enterprise - Summary Report</h1>
  <p>Generated on ${new Date().toLocaleString()}</p>
  
  <h2>Overview</h2>
  <div class="stat">
    <div class="stat-value">${tests.length}</div>
    <div class="stat-label">Total Tests</div>
  </div>
  <div class="stat">
    <div class="stat-value">${stats.totalRuns}</div>
    <div class="stat-label">Total Runs</div>
  </div>
  <div class="stat">
    <div class="stat-value">${stats.successRate}%</div>
    <div class="stat-label">Success Rate</div>
  </div>
  <div class="stat">
    <div class="stat-value">${formatMetric(stats.avgResponseTime, "ms")}</div>
    <div class="stat-label">Avg Response Time</div>
  </div>

  <h2>Recent Runs</h2>
  <table>
    <tr><th>Test</th><th>Duration</th><th>Throughput</th><th>Response Time</th><th>Errors</th></tr>
    ${runs.slice(0, 10).map((r) => `
    <tr>
      <td>${r.testName}</td>
      <td>${formatDuration(r.duration)}</td>
      <td>${formatMetric(r.throughput, "req/s")}</td>
      <td>${formatMetric(r.avgResponseTime, "ms")}</td>
      <td>${r.errorRate.toFixed(1)}%</td>
    </tr>`).join("")}
  </table>

  <div class="footer">
    <p>SpeedRunner Enterprise Performance Dashboard Report</p>
  </div>
</body>
</html>`;
}

function generateDetailedReport(
  tests: Array<{ name: string; status: string; virtualUsers: number; targetUrl: string; scriptType: string }>,
  runs: Array<{ testName: string; duration: number; throughput: number; avgResponseTime: number; errorRate: number; status: string; startedAt: string; completedAt: string }>,
  stats: { totalRuns: number; avgResponseTime: number; p50ResponseTime: number; p90ResponseTime: number; p95ResponseTime: number; avgThroughput: number; successRate: number; bestRun: { testName: string } | null; worstRun: { testName: string } | null }
): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>SpeedRunner Detailed Report</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
    h1 { color: #032147; border-bottom: 2px solid #209dd7; padding-bottom: 10px; }
    h2 { color: #032147; margin-top: 30px; }
    .stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0; }
    .stat { padding: 15px; background: #f7f8fa; border-radius: 8px; }
    .stat-value { font-size: 20px; font-weight: bold; color: #209dd7; }
    .stat-label { font-size: 12px; color: #64748b; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e7edf1; }
    th { background: #f7f8fa; font-weight: 600; }
    .highlight { background: #ecfdf5; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e7edf1; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <h1>SpeedRunner Enterprise - Detailed Report</h1>
  <p>Generated on ${new Date().toLocaleString()}</p>
  
  <h2>Performance Metrics</h2>
  <div class="stat-grid">
    <div class="stat"><div class="stat-value">${stats.totalRuns}</div><div class="stat-label">Total Runs</div></div>
    <div class="stat"><div class="stat-value">${stats.successRate}%</div><div class="stat-label">Success Rate</div></div>
    <div class="stat"><div class="stat-value">${formatMetric(stats.avgResponseTime, "ms")}</div><div class="stat-label">Avg Response Time</div></div>
    <div class="stat"><div class="stat-value">${formatMetric(stats.avgThroughput, "req/s")}</div><div class="stat-label">Avg Throughput</div></div>
    <div class="stat"><div class="stat-value">${formatMetric(stats.p50ResponseTime, "ms")}</div><div class="stat-label">P50 Response Time</div></div>
    <div class="stat"><div class="stat-value">${formatMetric(stats.p90ResponseTime, "ms")}</div><div class="stat-label">P90 Response Time</div></div>
    <div class="stat"><div class="stat-value">${formatMetric(stats.p95ResponseTime, "ms")}</div><div class="stat-label">P95 Response Time</div></div>
  </div>

  ${stats.bestRun ? `<p><strong>Best Run:</strong> ${stats.bestRun.testName}</p>` : ""}
  ${stats.worstRun ? `<p><strong>Worst Run:</strong> ${stats.worstRun.testName}</p>` : ""}

  <h2>All Tests (${tests.length})</h2>
  <table>
    <tr><th>Name</th><th>Status</th><th>Users</th><th>URL</th></tr>
    ${tests.map((t) => `
    <tr>
      <td>${t.name}</td>
      <td>${t.status}</td>
      <td>${t.virtualUsers}</td>
      <td style="font-size:11px">${t.targetUrl}</td>
    </tr>`).join("")}
  </table>

  <h2>All Runs (${runs.length})</h2>
  <table>
    <tr><th>Test</th><th>Status</th><th>Duration</th><th>Throughput</th><th>Response</th><th>Errors</th></tr>
    ${runs.map((r) => `
    <tr class="${r.status === "failed" ? "highlight" : ""}">
      <td>${r.testName}</td>
      <td>${r.status}</td>
      <td>${formatDuration(r.duration)}</td>
      <td>${formatMetric(r.throughput, "req/s")}</td>
      <td>${formatMetric(r.avgResponseTime, "ms")}</td>
      <td>${r.errorRate.toFixed(1)}%</td>
    </tr>`).join("")}
  </table>

  <div class="footer">
    <p>SpeedRunner Enterprise Performance Dashboard Report</p>
  </div>
</body>
</html>`;
}

function generateSLAReport(
  tests: Array<{ name: string; status: string }>,
  runs: Array<{ testName: string; avgResponseTime: number; throughput: number; errorRate: number }>,
  stats: { totalRuns: number; successRate: number },
  thresholds: Array<{ name: string; metric: string; condition: string; value: number; enabled: boolean }>
): string {
  const enabledThresholds = thresholds.filter((t) => t.enabled);

  return `<!DOCTYPE html>
<html>
<head>
  <title>SpeedRunner SLA Compliance Report</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
    h1 { color: #032147; border-bottom: 2px solid #209dd7; padding-bottom: 10px; }
    h2 { color: #032147; margin-top: 30px; }
    .sla-card { padding: 15px; background: #f7f8fa; border-radius: 8px; margin: 10px 0; border-left: 4px solid #209dd7; }
    .sla-metric { font-weight: bold; color: #032147; }
    .sla-value { color: #64748b; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e7edf1; }
    th { background: #f7f8fa; font-weight: 600; }
    .pass { color: #16a34a; }
    .fail { color: #dc2626; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e7edf1; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <h1>SpeedRunner Enterprise - SLA Compliance Report</h1>
  <p>Generated on ${new Date().toLocaleString()}</p>
  
  <h2>SLA Thresholds</h2>
  ${enabledThresholds.map((t) => `
  <div class="sla-card">
    <div class="sla-metric">${t.name}</div>
    <div class="sla-value">${t.metric} ${t.condition === "lessThan" ? "<" : ">"} ${t.value}${t.metric === "avgResponseTime" ? "ms" : t.metric === "errorRate" ? "%" : " req/s"}</div>
  </div>`).join("")}

  <h2>Compliance Summary</h2>
  <p><strong>Total Runs:</strong> ${stats.totalRuns}</p>
  <p><strong>Success Rate:</strong> ${stats.successRate}%</p>

  <h2>Run Compliance Details</h2>
  <table>
    <tr><th>Test</th><th>Response Time</th><th>Throughput</th><th>Error Rate</th></tr>
    ${runs.map((r) => {
      const rtThreshold = enabledThresholds.find((t) => t.metric === "avgResponseTime");
      const rtPass = rtThreshold
        ? rtThreshold.condition === "lessThan"
          ? r.avgResponseTime < rtThreshold.value
          : r.avgResponseTime > rtThreshold.value
        : true;
      return `
    <tr>
      <td>${r.testName}</td>
      <td class="${rtPass ? "pass" : "fail"}">${formatMetric(r.avgResponseTime, "ms")} ${rtPass ? "✓" : "✗"}</td>
      <td>${formatMetric(r.throughput, "req/s")}</td>
      <td>${r.errorRate.toFixed(1)}%</td>
    </tr>`;
    }).join("")}
  </table>

  <div class="footer">
    <p>SpeedRunner Enterprise SLA Compliance Report</p>
  </div>
</body>
</html>`;
}
