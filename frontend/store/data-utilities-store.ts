import { create } from "zustand";

import type {
  DataExportConfig,
  DataImportConfig,
  DataUtilitiesState,
  ScheduledExport,
} from "@/types";

const EXPORTS_KEY = "speedrunner-data-exports";
const IMPORTS_KEY = "speedrunner-data-imports";
const SCHEDULED_KEY = "speedrunner-scheduled-exports";

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

const defaultExports: DataExportConfig[] = [
  {
    id: "exp-1",
    name: "All Test Runs",
    format: "csv",
    dataSource: "runs",
    createdAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "exp-2",
    name: "Performance Summary",
    format: "json",
    dataSource: "analytics",
    createdAt: "2025-01-01T00:00:00Z",
  },
];

export interface DataUtilitiesStore extends DataUtilitiesState {
  createExport: (config: Omit<DataExportConfig, "id" | "createdAt">) => DataExportConfig;
  updateExport: (id: string, updates: Partial<DataExportConfig>) => void;
  deleteExport: (id: string) => void;
  runExport: (id: string) => void;

  createImport: (config: Omit<DataImportConfig, "id" | "createdAt">) => DataImportConfig;
  updateImport: (id: string, updates: Partial<DataImportConfig>) => void;
  deleteImport: (id: string) => void;

  createScheduledExport: (exportConfig: Omit<ScheduledExport, "id" | "createdAt">) => ScheduledExport;
  updateScheduledExport: (id: string, updates: Partial<ScheduledExport>) => void;
  deleteScheduledExport: (id: string) => void;
  toggleScheduledExport: (id: string) => void;
}

export const useDataUtilitiesStore = create<DataUtilitiesStore>((set, get) => ({
  exports: getStored<DataExportConfig>(EXPORTS_KEY).length > 0
    ? getStored<DataExportConfig>(EXPORTS_KEY)
    : defaultExports,
  imports: getStored<DataImportConfig>(IMPORTS_KEY),
  scheduledExports: getStored<ScheduledExport>(SCHEDULED_KEY),

  createExport: (config) => {
    const newConfig: DataExportConfig = {
      ...config,
      id: `export-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [...get().exports, newConfig];
    save(EXPORTS_KEY, updated);
    set({ exports: updated });
    return newConfig;
  },

  updateExport: (id, updates) => {
    const updated = get().exports.map((e) =>
      e.id === id ? { ...e, ...updates } : e,
    );
    save(EXPORTS_KEY, updated);
    set({ exports: updated });
  },

  deleteExport: (id) => {
    const updated = get().exports.filter((e) => e.id !== id);
    save(EXPORTS_KEY, updated);
    set({ exports: updated });
  },

  runExport: (id) => {
    // Simulate running an export
    console.log(`Running export: ${id}`);
  },

  createImport: (config) => {
    const newConfig: DataImportConfig = {
      ...config,
      id: `import-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [...get().imports, newConfig];
    save(IMPORTS_KEY, updated);
    set({ imports: updated });
    return newConfig;
  },

  updateImport: (id, updates) => {
    const updated = get().imports.map((i) =>
      i.id === id ? { ...i, ...updates } : i,
    );
    save(IMPORTS_KEY, updated);
    set({ imports: updated });
  },

  deleteImport: (id) => {
    const updated = get().imports.filter((i) => i.id !== id);
    save(IMPORTS_KEY, updated);
    set({ imports: updated });
  },

  createScheduledExport: (exportConfig) => {
    const newConfig: ScheduledExport = {
      ...exportConfig,
      id: `sched-export-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [...get().scheduledExports, newConfig];
    save(SCHEDULED_KEY, updated);
    set({ scheduledExports: updated });
    return newConfig;
  },

  updateScheduledExport: (id, updates) => {
    const updated = get().scheduledExports.map((e) =>
      e.id === id ? { ...e, ...updates } : e,
    );
    save(SCHEDULED_KEY, updated);
    set({ scheduledExports: updated });
  },

  deleteScheduledExport: (id) => {
    const updated = get().scheduledExports.filter((e) => e.id !== id);
    save(SCHEDULED_KEY, updated);
    set({ scheduledExports: updated });
  },

  toggleScheduledExport: (id) => {
    const updated = get().scheduledExports.map((e) =>
      e.id === id ? { ...e, enabled: !e.enabled } : e,
    );
    save(SCHEDULED_KEY, updated);
    set({ scheduledExports: updated });
  },
}));