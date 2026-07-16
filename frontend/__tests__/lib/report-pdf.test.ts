import { describe, it, expect } from "vitest";
import { generateReportHTML, type ReportData } from "@/lib/report-pdf";
import type { ReportTemplate, Run, Test, SLAThreshold } from "@/types";

const mockTests: Test[] = [
  { id: "t1", name: "Login Test", description: "Test login", scriptType: "HTTP", targetUrl: "https://example.com/login", virtualUsers: 50, status: "completed", createdAt: "2025-01-01T00:00:00Z", lastRunAt: "2025-01-02T00:00:00Z" },
  { id: "t2", name: "API Stress Test", description: "Stress test", scriptType: "JMeter", targetUrl: "https://example.com/api", virtualUsers: 200, status: "completed", createdAt: "2025-01-01T00:00:00Z", lastRunAt: "2025-01-02T00:00:00Z" },
];

const mockRuns: Run[] = [
  { id: "r1", testId: "t1", testName: "Login Test", status: "completed", startedAt: "2025-01-02T10:00:00Z", completedAt: "2025-01-02T10:05:00Z", duration: 300, throughput: 120, avgResponseTime: 150, errorRate: 0.5 },
  { id: "r2", testId: "t1", testName: "Login Test", status: "completed", startedAt: "2025-01-02T11:00:00Z", completedAt: "2025-01-02T11:05:00Z", duration: 300, throughput: 115, avgResponseTime: 160, errorRate: 0.3 },
  { id: "r3", testId: "t2", testName: "API Stress Test", status: "completed", startedAt: "2025-01-02T12:00:00Z", completedAt: "2025-01-02T12:02:00Z", duration: 120, throughput: 50, avgResponseTime: 500, errorRate: 5.0 },
];

const mockThresholds: SLAThreshold[] = [
  { id: "sla1", name: "Response Time", metric: "avgResponseTime", condition: "lessThan", value: 300, enabled: true },
  { id: "sla2", name: "Error Rate", metric: "errorRate", condition: "lessThan", value: 1.0, enabled: true },
];

const executiveTemplate: ReportTemplate = {
  id: "tpl-1",
  name: "Executive Summary",
  description: "High-level overview",
  type: "executive",
  sections: [
    { id: "s1", title: "Summary", type: "summary", config: {} },
    { id: "s2", title: "Metrics", type: "metrics", config: {} },
  ],
  createdAt: "2025-01-01T00:00:00Z",
  usageCount: 0,
};

const technicalTemplate: ReportTemplate = {
  id: "tpl-2",
  name: "Technical Report",
  description: "Detailed technical analysis",
  type: "technical",
  sections: [
    { id: "s1", title: "Metrics", type: "metrics", config: {} },
    { id: "s2", title: "Trend", type: "chart", config: {} },
    { id: "s3", title: "Details", type: "table", config: {} },
  ],
  createdAt: "2025-01-01T00:00:00Z",
  usageCount: 0,
};

function makeData(template: ReportTemplate, runs: Run[] = mockRuns): ReportData {
  return {
    generatedAt: "2025-06-15T12:00:00Z",
    template,
    tests: mockTests,
    runs,
    slaThresholds: mockThresholds,
  };
}

describe("generateReportHTML", () => {
  it("returns valid HTML with doctype", () => {
    const html = generateReportHTML(makeData(executiveTemplate));
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
  });

  it("includes report title and metadata", () => {
    const html = generateReportHTML(makeData(executiveTemplate));
    expect(html).toContain("Executive Summary");
    expect(html).toContain("High-level overview");
    expect(html).toContain("Generated:");
    expect(html).toContain("Type: Executive");
  });

  it("renders metrics section with correct values", () => {
    const html = generateReportHTML(makeData(executiveTemplate));
    expect(html).toContain("Performance Metrics");
    expect(html).toContain("3"); // 3 completed runs
    expect(html).toContain("100%"); // success rate (3/3)
  });

  it("renders chart section with bar chart", () => {
    const html = generateReportHTML(makeData(technicalTemplate));
    expect(html).toContain("Response Time Trend");
    expect(html).toContain("chart-bar");
  });

  it("renders table section with test and run data", () => {
    const html = generateReportHTML(makeData(technicalTemplate));
    expect(html).toContain("Test Configurations");
    expect(html).toContain("Login Test");
    expect(html).toContain("API Stress Test");
    expect(html).toContain("Recent Runs");
  });

  it("renders summary section with SLA compliance", () => {
    const html = generateReportHTML(makeData(executiveTemplate));
    expect(html).toContain("Executive Summary");
    expect(html).toContain("SLA Compliance");
    expect(html).toContain("Response Time");
    expect(html).toContain("Error Rate");
  });

  it("marks violated SLA thresholds", () => {
    const html = generateReportHTML(makeData(executiveTemplate));
    // Run r3 has avgResponseTime=500 which exceeds threshold of 300
    expect(html).toContain("violation");
    expect(html).toContain("violated");
  });

  it("handles empty runs gracefully", () => {
    const html = generateReportHTML(makeData(executiveTemplate, []));
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("0"); // 0 completed runs
  });

  it("escapes HTML in test names", () => {
    const dangerousTest: Test = { ...mockTests[0], name: '<script>alert("xss")</script>' };
    const data = makeData(technicalTemplate);
    data.tests = [dangerousTest];
    const html = generateReportHTML(data);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;xss&quot;");
  });

  it("includes SpeedRunner branding in footer", () => {
    const html = generateReportHTML(makeData(executiveTemplate));
    expect(html).toContain("SpeedRunner Enterprise");
  });

  it("includes print media queries", () => {
    const html = generateReportHTML(makeData(executiveTemplate));
    expect(html).toContain("@media print");
    expect(html).toContain("@page");
  });
});
