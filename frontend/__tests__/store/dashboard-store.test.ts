import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDashboardStore } from "@/store/dashboard-store";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

vi.stubGlobal("localStorage", localStorageMock);

describe("dashboard store", () => {
  beforeEach(() => {
    localStorageMock.clear();
    useDashboardStore.setState({
      sections: useDashboardStore.getState().sections.map((s) => ({
        ...s,
        visible: true,
        collapsed: false,
      })),
      views: [],
      activeViewId: null,
      isCustomizing: false,
    });
  });

  it("toggles section visibility", () => {
    const initialVisible = useDashboardStore.getState().sections[0].visible;
    useDashboardStore.getState().toggleSectionVisibility("summary");
    expect(useDashboardStore.getState().sections[0].visible).toBe(!initialVisible);
  });

  it("toggles section collapsed state", () => {
    const initialCollapsed = useDashboardStore.getState().sections[0].collapsed;
    useDashboardStore.getState().toggleSectionCollapsed("summary");
    expect(useDashboardStore.getState().sections[0].collapsed).toBe(!initialCollapsed);
  });

  it("saves and loads views", () => {
    expect(useDashboardStore.getState().views).toHaveLength(0);

    useDashboardStore.getState().saveView("My View");
    expect(useDashboardStore.getState().views).toHaveLength(1);
    expect(useDashboardStore.getState().views[0].name).toBe("My View");
    expect(useDashboardStore.getState().activeViewId).toBe(useDashboardStore.getState().views[0].id);
  });

  it("loads a saved view", () => {
    useDashboardStore.getState().saveView("View 1");
    const viewId = useDashboardStore.getState().views[0].id;

    // Toggle a section
    useDashboardStore.getState().toggleSectionVisibility("summary");

    // Load the view
    useDashboardStore.getState().loadView(viewId);
    expect(useDashboardStore.getState().sections[0].visible).toBe(true);
  });

  it("deletes a view", () => {
    useDashboardStore.getState().saveView("View 1");
    const viewId = useDashboardStore.getState().views[0].id;

    useDashboardStore.getState().deleteView(viewId);
    expect(useDashboardStore.getState().views).toHaveLength(0);
    expect(useDashboardStore.getState().activeViewId).toBeNull();
  });

  it("resets to defaults", () => {
    useDashboardStore.getState().toggleSectionVisibility("summary");
    useDashboardStore.getState().saveView("Custom View");

    useDashboardStore.getState().resetToDefaults();
    expect(useDashboardStore.getState().sections[0].visible).toBe(true);
    expect(useDashboardStore.getState().activeViewId).toBeNull();
  });

  it("manages refresh config", () => {
    expect(useDashboardStore.getState().refreshConfig.enabled).toBe(false);

    useDashboardStore.getState().setRefreshEnabled(true);
    expect(useDashboardStore.getState().refreshConfig.enabled).toBe(true);

    useDashboardStore.getState().setRefreshInterval(60_000);
    expect(useDashboardStore.getState().refreshConfig.intervalMs).toBe(60_000);

    useDashboardStore.getState().markRefreshed();
    expect(useDashboardStore.getState().refreshConfig.lastRefreshedAt).not.toBeNull();
  });

  it("sets customizing state", () => {
    expect(useDashboardStore.getState().isCustomizing).toBe(false);

    useDashboardStore.getState().setCustomizing(true);
    expect(useDashboardStore.getState().isCustomizing).toBe(true);
  });
});
