import { create } from "zustand";

import type {
  DashboardSection,
  DashboardSectionConfig,
  DashboardView,
  RefreshConfig,
} from "@/types";

const VIEWS_KEY = "speedrunner-views";
const REFRESH_KEY = "speedrunner-refresh";

const defaultSections: DashboardSectionConfig[] = [
  { id: "summary", label: "Summary Cards", visible: true, collapsed: false },
  { id: "charts", label: "Trend Charts", visible: true, collapsed: false },
  { id: "activeTests", label: "Active Tests", visible: true, collapsed: false },
  { id: "recentRuns", label: "Recent Runs", visible: true, collapsed: false },
  { id: "comparison", label: "Run Comparison", visible: true, collapsed: false },
  { id: "analytics", label: "Performance Analytics", visible: true, collapsed: false },
  { id: "sla", label: "SLA Thresholds", visible: true, collapsed: false },
  { id: "templates", label: "Test Templates", visible: true, collapsed: false },
  { id: "scheduler", label: "Test Schedule", visible: true, collapsed: false },
  { id: "timeline", label: "Test Timeline", visible: true, collapsed: false },
  { id: "profile", label: "Your Profile", visible: true, collapsed: false },
  { id: "users", label: "User Management", visible: true, collapsed: false },
  { id: "infrastructure", label: "Infrastructure Health", visible: true, collapsed: false },
];

function getStoredViews(): DashboardView[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(VIEWS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveViews(views: DashboardView[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(VIEWS_KEY, JSON.stringify(views));
}

function getStoredRefresh(): RefreshConfig {
  if (typeof window === "undefined") {
    return { enabled: false, intervalMs: 30_000, lastRefreshedAt: null };
  }
  try {
    const stored = localStorage.getItem(REFRESH_KEY);
    return stored ? JSON.parse(stored) : { enabled: false, intervalMs: 30_000, lastRefreshedAt: null };
  } catch {
    return { enabled: false, intervalMs: 30_000, lastRefreshedAt: null };
  }
}

function saveRefresh(config: RefreshConfig) {
  if (typeof window === "undefined") return;
  localStorage.setItem(REFRESH_KEY, JSON.stringify(config));
}

export interface DashboardStore {
  sections: DashboardSectionConfig[];
  views: DashboardView[];
  activeViewId: string | null;
  refreshConfig: RefreshConfig;
  isCustomizing: boolean;

  toggleSectionVisibility: (sectionId: DashboardSection) => void;
  toggleSectionCollapsed: (sectionId: DashboardSection) => void;
  setSections: (sections: DashboardSectionConfig[]) => void;
  resetToDefaults: () => void;

  saveView: (name: string) => void;
  loadView: (viewId: string) => void;
  deleteView: (viewId: string) => void;
  setActiveView: (viewId: string | null) => void;

  setRefreshEnabled: (enabled: boolean) => void;
  setRefreshInterval: (intervalMs: number) => void;
  markRefreshed: () => void;

  setCustomizing: (customizing: boolean) => void;
}

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  sections: defaultSections,
  views: getStoredViews(),
  activeViewId: null,
  refreshConfig: getStoredRefresh(),
  isCustomizing: false,

  toggleSectionVisibility: (sectionId) => {
    set((state) => ({
      sections: state.sections.map((s) =>
        s.id === sectionId ? { ...s, visible: !s.visible } : s,
      ),
    }));
  },

  toggleSectionCollapsed: (sectionId) => {
    set((state) => ({
      sections: state.sections.map((s) =>
        s.id === sectionId ? { ...s, collapsed: !s.collapsed } : s,
      ),
    }));
  },

  setSections: (sections) => {
    set({ sections });
  },

  resetToDefaults: () => {
    set({ sections: defaultSections, activeViewId: null });
  },

  saveView: (name) => {
    const { sections, views } = get();
    const newView: DashboardView = {
      id: `view-${Date.now()}`,
      name,
      sections: [...sections],
      createdAt: new Date().toISOString(),
      isDefault: false,
    };
    const updatedViews = [...views, newView];
    saveViews(updatedViews);
    set({ views: updatedViews, activeViewId: newView.id });
  },

  loadView: (viewId) => {
    const { views } = get();
    const view = views.find((v) => v.id === viewId);
    if (view) {
      set({ sections: [...view.sections], activeViewId: viewId });
    }
  },

  deleteView: (viewId) => {
    const { views, activeViewId } = get();
    const updatedViews = views.filter((v) => v.id !== viewId);
    saveViews(updatedViews);
    set({
      views: updatedViews,
      activeViewId: activeViewId === viewId ? null : activeViewId,
    });
  },

  setActiveView: (viewId) => {
    set({ activeViewId: viewId });
  },

  setRefreshEnabled: (enabled) => {
    const config = { ...get().refreshConfig, enabled };
    saveRefresh(config);
    set({ refreshConfig: config });
  },

  setRefreshInterval: (intervalMs) => {
    const config = { ...get().refreshConfig, intervalMs };
    saveRefresh(config);
    set({ refreshConfig: config });
  },

  markRefreshed: () => {
    const config = { ...get().refreshConfig, lastRefreshedAt: new Date().toISOString() };
    saveRefresh(config);
    set({ refreshConfig: config });
  },

  setCustomizing: (customizing) => {
    set({ isCustomizing: customizing });
  },
}));

// Selector to check if a section is visible
export const selectSectionVisible = (sectionId: DashboardSection) => (state: DashboardStore) =>
  state.sections.find((s) => s.id === sectionId)?.visible ?? true;

// Selector to check if a section is collapsed
export const selectSectionCollapsed = (sectionId: DashboardSection) => (state: DashboardStore) =>
  state.sections.find((s) => s.id === sectionId)?.collapsed ?? false;
