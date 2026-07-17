import type { ReportTemplate, Run, Test, SLAThreshold } from "@/types";
import { formatDuration, formatMetric } from "./utils";

export interface ReportData {
  generatedAt: string;
  template: ReportTemplate;
  tests: Test[];
  runs: Run[];
  slaThresholds: SLAThreshold[];
}

export function generateReportHTML(data: ReportData): string {
  const { generatedAt, template, tests, runs, slaThresholds } = data;
  const completedRuns = runs.filter((r) => r.status === "completed");
  const failedRuns = runs.filter((r) => r.status === "failed");

  const totalRuns = completedRuns.length;
  const avgResponseTime = totalRuns > 0
    ? completedRuns.reduce((sum, r) => sum + r.avgResponseTime, 0) / totalRuns
    : 0;
  const avgThroughput = totalRuns > 0
    ? completedRuns.reduce((sum, r) => sum + r.throughput, 0) / totalRuns
    : 0;
  const successRate = runs.length > 0
    ? (completedRuns.length / runs.length) * 100
    : 0;

  const p50 = totalRuns > 0
    ? completedRuns.sort((a, b) => a.avgResponseTime - b.avgResponseTime)[Math.floor(totalRuns * 0.5)]?.avgResponseTime ?? 0
    : 0;
  const p90 = totalRuns > 0
    ? completedRuns.sort((a, b) => a.avgResponseTime - b.avgResponseTime)[Math.floor(totalRuns * 0.9)]?.avgResponseTime ?? 0
    : 0;
  const p95 = totalRuns > 0
    ? completedRuns.sort((a, b) => a.avgResponseTime - b.avgResponseTime)[Math.floor(totalRuns * 0.95)]?.avgResponseTime ?? 0
    : 0;

  const sections: string[] = [];

  for (const section of template.sections) {
    switch (section.type) {
      case "metrics":
        sections.push(renderMetricsSection(tests, completedRuns, { totalRuns, avgResponseTime, avgThroughput, successRate, p50, p90, p95 }));
        break;
      case "chart":
        sections.push(renderChartSection(completedRuns));
        break;
      case "table":
        sections.push(renderTableSection(tests, completedRuns));
        break;
      case "summary":
        sections.push(renderSummarySection(tests, completedRuns, failedRuns, slaThresholds));
        break;
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${template.name} - SpeedRunner Enterprise</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1e293b;
      background: #fff;
      line-height: 1.6;
      padding: 40px;
    }
    .report-header {
      border-bottom: 3px solid #032147;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .report-header h1 {
      font-size: 24px;
      color: #032147;
      font-weight: 700;
    }
    .report-header .subtitle {
      font-size: 14px;
      color: #64748b;
      margin-top: 4px;
    }
    .report-header .meta {
      display: flex;
      gap: 20px;
      margin-top: 12px;
      font-size: 12px;
      color: #94a3b8;
    }
    .section { margin-bottom: 32px; }
    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #032147;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 8px;
      margin-bottom: 16px;
    }
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }
    .metric-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
    }
    .metric-value {
      font-size: 22px;
      font-weight: 700;
      color: #032147;
    }
    .metric-label {
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }
    .metric-card.highlight { border-color: #209dd7; background: #f0f9ff; }
    .metric-card.highlight .metric-value { color: #209dd7; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th {
      background: #f1f5f9;
      font-weight: 600;
      text-align: left;
      padding: 10px 12px;
      border-bottom: 2px solid #e2e8f0;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #f1f5f9;
    }
    tr:hover td { background: #f8fafc; }
    .status-pass { color: #16a34a; font-weight: 600; }
    .status-fail { color: #dc2626; font-weight: 600; }
    .status-running { color: #d97706; font-weight: 600; }
    .chart-placeholder {
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 24px;
      text-align: center;
      color: #94a3b8;
    }
    .chart-bars {
      display: flex;
      align-items: flex-end;
      gap: 4px;
      height: 120px;
      padding: 0 8px;
    }
    .chart-bar {
      flex: 1;
      background: #209dd7;
      border-radius: 3px 3px 0 0;
      min-width: 8px;
      transition: background 0.2s;
    }
    .chart-bar:hover { background: #032147; }
    .chart-label {
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
      font-size: 10px;
      color: #94a3b8;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
    }
    .summary-card h4 {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .sla-card {
      border-left: 4px solid #209dd7;
      background: #f8fafc;
      padding: 12px 16px;
      border-radius: 0 8px 8px 0;
      margin-bottom: 8px;
    }
    .sla-card.violated { border-left-color: #dc2626; background: #fef2f2; }
    .report-footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 16px;
      margin-top: 40px;
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
    }
    @media print {
      body { padding: 20px; }
      .no-print { display: none !important; }
      .metric-card, .summary-card, .sla-card { break-inside: avoid; }
      table { break-inside: avoid; }
    }
    @page { margin: 15mm; size: A4; }
  </style>
</head>
<body>
  <div class="report-header">
    <h1>${template.name}</h1>
    <p class="subtitle">${template.description || "SpeedRunner Enterprise Performance Report"}</p>
    <div class="meta">
      <span>Generated: ${new Date(generatedAt).toLocaleString()}</span>
      <span>Type: ${template.type.charAt(0).toUpperCase() + template.type.slice(1)}</span>
      <span>Tests: ${tests.length}</span>
      <span>Runs: ${runs.length}</span>
    </div>
  </div>

  ${sections.join("\n")}

  <div class="report-footer">
    SpeedRunner Enterprise &middot; Performance Testing Dashboard &middot; ${new Date(generatedAt).toLocaleDateString()}
  </div>
</body>
</html>`;
}

function renderMetricsSection(
  tests: Test[],
  runs: Run[],
  stats: { totalRuns: number; avgResponseTime: number; avgThroughput: number; successRate: number; p50: number; p90: number; p95: number },
): string {
  return `
  <div class="section">
    <h2 class="section-title">Performance Metrics</h2>
    <div class="metric-grid">
      <div class="metric-card highlight">
        <div class="metric-value">${stats.totalRuns}</div>
        <div class="metric-label">Total Runs</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${stats.successRate.toFixed(1)}%</div>
        <div class="metric-label">Success Rate</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${formatMetric(stats.avgResponseTime, "ms")}</div>
        <div class="metric-label">Avg Response Time</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${formatMetric(stats.avgThroughput, "req/s")}</div>
        <div class="metric-label">Avg Throughput</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${formatMetric(stats.p50, "ms")}</div>
        <div class="metric-label">P50 Response Time</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${formatMetric(stats.p90, "ms")}</div>
        <div class="metric-label">P90 Response Time</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${formatMetric(stats.p95, "ms")}</div>
        <div class="metric-label">P95 Response Time</div>
      </div>
      <div class="metric-card">
        <div class="metric-value">${tests.length}</div>
        <div class="metric-label">Total Tests</div>
      </div>
    </div>
  </div>`;
}

function renderChartSection(runs: Run[]): string {
  if (runs.length === 0) {
    return `<div class="section"><h2 class="section-title">Response Time Trend</h2><div class="chart-placeholder">No completed runs to display</div></div>`;
  }

  const sorted = [...runs].sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());
  const sliced = sorted.slice(-20);
  const maxRT = Math.max(...sliced.map((r) => r.avgResponseTime), 1);

  const bars = sliced.map((r) => {
    const height = Math.round((r.avgResponseTime / maxRT) * 100);
    return `<div class="chart-bar" style="height: ${height}%" title="${r.testName}: ${r.avgResponseTime.toFixed(0)}ms"></div>`;
  }).join("");

  return `
  <div class="section">
    <h2 class="section-title">Response Time Trend</h2>
    <div class="chart-placeholder">
      <div class="chart-bars">${bars}</div>
      <div class="chart-label">
        <span>${sliced[0] ? new Date(sliced[0].completedAt).toLocaleDateString() : ""}</span>
        <span>Recent runs (up to 20)</span>
        <span>${sliced[sliced.length - 1] ? new Date(sliced[sliced.length - 1].completedAt).toLocaleDateString() : ""}</span>
      </div>
    </div>
  </div>`;
}

function renderTableSection(tests: Test[], runs: Run[]): string {
  const testRows = tests.slice(0, 20).map((t) => `
    <tr>
      <td>${escapeHtml(t.name)}</td>
      <td><span class="status-${t.status === "completed" ? "pass" : t.status === "failed" ? "fail" : "running"}">${t.status}</span></td>
      <td>${t.virtualUsers}</td>
      <td>${escapeHtml(t.targetUrl)}</td>
    </tr>`).join("");

  const runRows = runs.slice(0, 20).map((r) => `
    <tr>
      <td>${escapeHtml(r.testName)}</td>
      <td><span class="status-${r.status === "completed" ? "pass" : r.status === "failed" ? "fail" : "running"}">${r.status}</span></td>
      <td>${formatDuration(r.duration)}</td>
      <td>${formatMetric(r.throughput, "req/s")}</td>
      <td>${formatMetric(r.avgResponseTime, "ms")}</td>
      <td>${r.errorRate.toFixed(2)}%</td>
    </tr>`).join("");

  return `
  <div class="section">
    <h2 class="section-title">Test Configurations (${tests.length})</h2>
    <table>
      <thead><tr><th>Name</th><th>Status</th><th>Virtual Users</th><th>Target URL</th></tr></thead>
      <tbody>${testRows}</tbody>
    </table>
  </div>
  <div class="section">
    <h2 class="section-title">Recent Runs (${runs.length})</h2>
    <table>
      <thead><tr><th>Test</th><th>Status</th><th>Duration</th><th>Throughput</th><th>Avg Response</th><th>Error Rate</th></tr></thead>
      <tbody>${runRows}</tbody>
    </table>
  </div>`;
}

function renderSummarySection(tests: Test[], completedRuns: Run[], failedRuns: Run[], slaThresholds: SLAThreshold[]): string {
  const enabledThresholds = slaThresholds.filter((t) => t.enabled);

  const slaCards = enabledThresholds.length > 0
    ? enabledThresholds.map((t) => {
        const violations = completedRuns.filter((r) => {
          if (t.metric === "avgResponseTime") {
            return t.condition === "lessThan"
              ? r.avgResponseTime >= t.value
              : r.avgResponseTime <= t.value;
          }
          if (t.metric === "errorRate") {
            return t.condition === "lessThan"
              ? r.errorRate >= t.value
              : r.errorRate <= t.value;
          }
          return false;
        });
        const violated = violations.length > 0;
        return `<div class="sla-card ${violated ? "violated" : ""}">
          <strong>${escapeHtml(t.name)}</strong>: ${t.metric} ${t.condition === "lessThan" ? "<" : ">"} ${t.value}${t.metric === "avgResponseTime" ? "ms" : t.metric === "errorRate" ? "%" : " req/s"}
          ${violated ? ` — ${violations.length} violation(s)` : " — Passing"}
        </div>`;
      }).join("")
    : "<p style='color: #94a3b8; font-size: 13px;'>No SLA thresholds configured.</p>";

  return `
  <div class="section">
    <h2 class="section-title">Executive Summary</h2>
    <div class="summary-grid">
      <div class="summary-card">
        <h4>Tests</h4>
        <div class="metric-value">${tests.length}</div>
        <div class="metric-label">Total Configured</div>
      </div>
      <div class="summary-card">
        <h4>Successful Runs</h4>
        <div class="metric-value" style="color: #16a34a;">${completedRuns.length}</div>
        <div class="metric-label">Completed</div>
      </div>
      <div class="summary-card">
        <h4>Failed Runs</h4>
        <div class="metric-value" style="color: ${failedRuns.length > 0 ? "#dc2626" : "#94a3b8"};">${failedRuns.length}</div>
        <div class="metric-label">Failed</div>
      </div>
    </div>
  </div>
  <div class="section">
    <h2 class="section-title">SLA Compliance</h2>
    ${slaCards}
  </div>`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function triggerPrintPDF(html: string, _filename?: string) {
  void _filename;
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(html);
  printWindow.document.close();

  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };
}

export function downloadReportHTML(html: string, filename: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
