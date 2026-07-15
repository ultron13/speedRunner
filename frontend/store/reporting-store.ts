import { create } from "zustand";

import type {
  AdvancedChart,
  AdvancedReportingState,
  ReportTemplate,
  ScheduledReport,
} from "@/types";

const CHARTS_KEY = "speedrunner-charts";
const TEMPLATES_KEY = "speedrunner-templates";
const SCHEDULED_KEY = "speedrunner-scheduled";

function getStored<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function save<T>(key: string, data: T[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(data));
}

const defaultTemplates: ReportTemplate[] = [
  {
    id: "tpl-executive",
    name: "Executive Summary",
    description: "High-level overview for stakeholders",
    type: "executive",
    sections: [
      { id: "s1", title: "Key Metrics", type: "metrics", config: {} },
      { id: "s2", title: "Performance Trends", type: "chart", config: {} },
      { id: "s3", title: "Recent Activity", type: "table", config: {} },
    ],
    createdAt: "2025-01-01T00:00:00Z",
    usageCount: 0,
  },
  {
    id: "tpl-technical",
    name: "Technical Deep Dive",
    description: "Detailed technical analysis for engineers",
    type: "technical",
    sections: [
      { id: "s1", title: "All Metrics", type: "metrics", config: {} },
      { id: "s2", title: "Response Time Distribution", type: "chart", config: {} },
      { id: "s3", title: "Error Analysis", type: "chart", config: {} },
      { id: "s4", title: "Full Run History", type: "table", config: {} },
    ],
    createdAt: "2025-01-01T00:00:00Z",
    usageCount: 0,
  },
  {
    id: "tpl-comparison",
    name: "Test Comparison",
    description: "Compare multiple test runs side by side",
    type: "comparison",
    sections: [
      { id: "s1", title: "Comparison Metrics", type: "metrics", config: {} },
      { id: "s2", title: "Side by Side", type: "chart", config: {} },
    ],
    createdAt: "2025-01-01T00:00:00Z",
    usageCount: 0,
  },
];

export interface ReportingStore extends AdvancedReportingState {
  createChart: (chart: Omit<AdvancedChart, "id" | "createdAt">) => AdvancedChart;
  updateChart: (id: string, updates: Partial<AdvancedChart>) => void;
  deleteChart: (id: string) => void;

  createTemplate: (template: Omit<ReportTemplate, "id" | "createdAt" | "usageCount">) => ReportTemplate;
  updateTemplate: (id: string, updates: Partial<ReportTemplate>) => void;
  deleteTemplate: (id: string) => void;
  applyTemplate: (id: string) => void;

  createScheduledReport: (report: Omit<ScheduledReport, "id" | "createdAt">) => ScheduledReport;
  updateScheduledReport: (id: string, updates: Partial<ScheduledReport>) => void;
  deleteScheduledReport: (id: string) => void;
  toggleScheduledReport: (id: string) => void;
}

export const useReportingStore = create<ReportingStore>((set, get) => ({
  charts: getStored<AdvancedChart>(CHARTS_KEY),
  templates: getStored<ReportTemplate>(TEMPLATES_KEY).length > 0
    ? getStored<ReportTemplate>(TEMPLATES_KEY)
    : defaultTemplates,
  scheduledReports: getStored<ScheduledReport>(SCHEDULED_KEY),

  createChart: (chart) => {
    const newChart: AdvancedChart = {
      ...chart,
      id: `chart-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [...get().charts, newChart];
    save(CHARTS_KEY, updated);
    set({ charts: updated });
    return newChart;
  },

  updateChart: (id, updates) => {
    const updated = get().charts.map((c) =>
      c.id === id ? { ...c, ...updates } : c,
    );
    save(CHARTS_KEY, updated);
    set({ charts: updated });
  },

  deleteChart: (id) => {
    const updated = get().charts.filter((c) => c.id !== id);
    save(CHARTS_KEY, updated);
    set({ charts: updated });
  },

  createTemplate: (template) => {
    const newTemplate: ReportTemplate = {
      ...template,
      id: `tpl-${Date.now()}`,
      createdAt: new Date().toISOString(),
      usageCount: 0,
    };
    const updated = [...get().templates, newTemplate];
    save(TEMPLATES_KEY, updated);
    set({ templates: updated });
    return newTemplate;
  },

  updateTemplate: (id, updates) => {
    const updated = get().templates.map((t) =>
      t.id === id ? { ...t, ...updates } : t,
    );
    save(TEMPLATES_KEY, updated);
    set({ templates: updated });
  },

  deleteTemplate: (id) => {
    const updated = get().templates.filter((t) => t.id !== id);
    save(TEMPLATES_KEY, updated);
    set({ templates: updated });
  },

  applyTemplate: (id) => {
    const updated = get().templates.map((t) =>
      t.id === id ? { ...t, usageCount: t.usageCount + 1 } : t,
    );
    save(TEMPLATES_KEY, updated);
    set({ templates: updated });
  },

  createScheduledReport: (report) => {
    const newReport: ScheduledReport = {
      ...report,
      id: `sched-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [...get().scheduledReports, newReport];
    save(SCHEDULED_KEY, updated);
    set({ scheduledReports: updated });
    return newReport;
  },

  updateScheduledReport: (id, updates) => {
    const updated = get().scheduledReports.map((r) =>
      r.id === id ? { ...r, ...updates } : r,
    );
    save(SCHEDULED_KEY, updated);
    set({ scheduledReports: updated });
  },

  deleteScheduledReport: (id) => {
    const updated = get().scheduledReports.filter((r) => r.id !== id);
    save(SCHEDULED_KEY, updated);
    set({ scheduledReports: updated });
  },

  toggleScheduledReport: (id) => {
    const updated = get().scheduledReports.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r,
    );
    save(SCHEDULED_KEY, updated);
    set({ scheduledReports: updated });
  },
}));