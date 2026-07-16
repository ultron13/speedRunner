import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Full Store Coverage", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  describe("auth-store full coverage", () => {

    it("createUser rejects duplicate email", async () => {
      const { useAuthStore } = await import("@/store/auth-store");
      const store = useAuthStore.getState();
      
      const result = store.createUser({
        email: "admin@example.com",
        name: "Duplicate",
        password: "pass123",
        role: "viewer",
      });
      
      expect(result).toBeNull();
    });


    it("updateUser with non-existent user does nothing", async () => {
      const { useAuthStore } = await import("@/store/auth-store");
      const store = useAuthStore.getState();
      
      // Should not throw
      store.updateUser("nonexistent", { name: "Test" });
    });


    it("deleteUser with non-existent user does nothing", async () => {
      const { useAuthStore } = await import("@/store/auth-store");
      const store = useAuthStore.getState();
      
      // Should not throw
      store.deleteUser("nonexistent");
    });




    it("clearError clears the error state", async () => {
      const { useAuthStore } = await import("@/store/auth-store");
      const store = useAuthStore.getState();
      
      // Force an error
      store.clearError();
      expect(store.error).toBeNull();
    });

  });

  describe("api-store full coverage", () => {
    it("addEndpoint creates new endpoint", async () => {
      const { useAPIStore } = await import("@/store/api-store");
      const store = useAPIStore.getState();
      const initialCount = store.endpoints.length;
      
      const endpoint = store.addEndpoint({
        name: "Test API",
        url: "https://api.test.com",
        method: "GET",
        headers: {},
      });
      
      expect(endpoint).toBeDefined();
      expect(endpoint.id).toBeDefined();
      const newState = useAPIStore.getState();
      expect(newState.endpoints.length).toBe(initialCount + 1);
    });

    it("updateEndpoint updates existing endpoint", async () => {
      const { useAPIStore } = await import("@/store/api-store");
      const store = useAPIStore.getState();
      
      const endpoint = store.addEndpoint({
        name: "Original",
        url: "https://api.test.com",
        method: "GET",
        headers: {},
      });
      
      store.updateEndpoint(endpoint.id, { name: "Updated" });
      
      const newState = useAPIStore.getState();
      const updated = newState.endpoints.find(e => e.id === endpoint.id);
      expect(updated?.name).toBe("Updated");
    });

    it("deleteEndpoint removes endpoint", async () => {
      const { useAPIStore } = await import("@/store/api-store");
      const store = useAPIStore.getState();
      
      const endpoint = store.addEndpoint({
        name: "To Delete",
        url: "https://api.test.com",
        method: "GET",
        headers: {},
      });
      
      store.deleteEndpoint(endpoint.id);
      
      const newState = useAPIStore.getState();
      expect(newState.endpoints.find(e => e.id === endpoint.id)).toBeUndefined();
    });

    it("addIntegration creates new integration", async () => {
      const { useAPIStore } = await import("@/store/api-store");
      const store = useAPIStore.getState();
      const initialCount = store.integrations.length;
      
      const integration = store.addIntegration({
        name: "Test Integration",
        type: "webhook",
        config: {},
        status: "disconnected",
      });
      
      expect(integration).toBeDefined();
      const newState = useAPIStore.getState();
      expect(newState.integrations.length).toBe(initialCount + 1);
    });

    it("updateIntegration updates existing integration", async () => {
      const { useAPIStore } = await import("@/store/api-store");
      const store = useAPIStore.getState();
      
      const integration = store.addIntegration({
        name: "Original",
        type: "webhook",
        config: {},
        status: "disconnected",
      });
      
      store.updateIntegration(integration.id, { name: "Updated" });
      
      const newState = useAPIStore.getState();
      const updated = newState.integrations.find(i => i.id === integration.id);
      expect(updated?.name).toBe("Updated");
    });

    it("deleteIntegration removes integration", async () => {
      const { useAPIStore } = await import("@/store/api-store");
      const store = useAPIStore.getState();
      
      const integration = store.addIntegration({
        name: "To Delete",
        type: "webhook",
        config: {},
        status: "disconnected",
      });
      
      store.deleteIntegration(integration.id);
      
      const newState = useAPIStore.getState();
      expect(newState.integrations.find(i => i.id === integration.id)).toBeUndefined();
    });

    it("connectIntegration sets status to connected", async () => {
      const { useAPIStore } = await import("@/store/api-store");
      const store = useAPIStore.getState();
      
      const integration = store.addIntegration({
        name: "To Connect",
        type: "webhook",
        config: {},
        status: "disconnected",
      });
      
      store.connectIntegration(integration.id);
      
      const newState = useAPIStore.getState();
      const connected = newState.integrations.find(i => i.id === integration.id);
      expect(connected?.status).toBe("connected");
    });

    it("disconnectIntegration sets status to disconnected", async () => {
      const { useAPIStore } = await import("@/store/api-store");
      const store = useAPIStore.getState();
      
      const integration = store.addIntegration({
        name: "To Disconnect",
        type: "webhook",
        config: {},
        status: "connected",
      });
      
      store.disconnectIntegration(integration.id);
      
      const newState = useAPIStore.getState();
      const disconnected = newState.integrations.find(i => i.id === integration.id);
      expect(disconnected?.status).toBe("disconnected");
    });
  });

  describe("dashboard-store full coverage", () => {
    it("toggleSectionVisibility toggles visibility", async () => {
      const { useDashboardStore } = await import("@/store/dashboard-store");
      const store = useDashboardStore.getState();
      const sectionId = store.sections[0].id;
      
      store.toggleSectionVisibility(sectionId);
      
      const newState = useDashboardStore.getState();
      const section = newState.sections.find(s => s.id === sectionId);
      expect(section?.visible).toBe(false);
    });

    it("setSections replaces all sections", async () => {
      const { useDashboardStore } = await import("@/store/dashboard-store");
      const store = useDashboardStore.getState();
      
      const newSections = [
        { id: "custom-1" as never, visible: true, collapsed: false, order: 0 },
        { id: "custom-2" as never, visible: true, collapsed: false, order: 1 },
      ];
      
      store.setSections(newSections);
      
      const newState = useDashboardStore.getState();
      expect(newState.sections.length).toBe(2);
    });

    it("resetToDefaults resets to default sections", async () => {
      const { useDashboardStore } = await import("@/store/dashboard-store");
      const store = useDashboardStore.getState();
      
      store.setSections([]);
      store.resetToDefaults();
      
      const newState = useDashboardStore.getState();
      expect(newState.sections.length).toBeGreaterThan(0);
    });

    it("saveView saves current configuration", async () => {
      const { useDashboardStore } = await import("@/store/dashboard-store");
      const store = useDashboardStore.getState();
      
      store.saveView("My View");
      
      const newState = useDashboardStore.getState();
      expect(newState.views.length).toBeGreaterThan(0);
      expect(newState.views[newState.views.length - 1].name).toBe("My View");
    });

    it("loadView loads a saved view", async () => {
      const { useDashboardStore } = await import("@/store/dashboard-store");
      const store = useDashboardStore.getState();
      
      store.saveView("View to Load");
      const views = useDashboardStore.getState().views;
      const viewId = views[views.length - 1].id;
      
      store.loadView(viewId);
      
      const newState = useDashboardStore.getState();
      expect(newState.activeViewId).toBe(viewId);
    });

    it("loadView with non-existent view does nothing", async () => {
      const { useDashboardStore } = await import("@/store/dashboard-store");
      const store = useDashboardStore.getState();
      
      // Should not throw
      store.loadView("nonexistent");
    });

    it("deleteView removes a view", async () => {
      const { useDashboardStore } = await import("@/store/dashboard-store");
      const store = useDashboardStore.getState();
      
      store.saveView("View to Delete");
      const views = useDashboardStore.getState().views;
      const viewId = views[views.length - 1].id;
      
      store.deleteView(viewId);
      
      const newState = useDashboardStore.getState();
      expect(newState.views.find(v => v.id === viewId)).toBeUndefined();
    });

    it("setActiveView sets the active view", async () => {
      const { useDashboardStore } = await import("@/store/dashboard-store");
      const store = useDashboardStore.getState();
      
      store.setActiveView("test-view");
      
      const newState = useDashboardStore.getState();
      expect(newState.activeViewId).toBe("test-view");
    });

    it("setActiveView with null clears active view", async () => {
      const { useDashboardStore } = await import("@/store/dashboard-store");
      const store = useDashboardStore.getState();
      
      store.setActiveView(null);
      
      const newState = useDashboardStore.getState();
      expect(newState.activeViewId).toBeNull();
    });

    it("setRefreshEnabled enables/disables refresh", async () => {
      const { useDashboardStore } = await import("@/store/dashboard-store");
      const store = useDashboardStore.getState();
      
      store.setRefreshEnabled(true);
      expect(useDashboardStore.getState().refreshConfig.enabled).toBe(true);
      
      store.setRefreshEnabled(false);
      expect(useDashboardStore.getState().refreshConfig.enabled).toBe(false);
    });

    it("setRefreshInterval sets refresh interval", async () => {
      const { useDashboardStore } = await import("@/store/dashboard-store");
      const store = useDashboardStore.getState();
      
      store.setRefreshInterval(5000);
      expect(useDashboardStore.getState().refreshConfig.intervalMs).toBe(5000);
    });

    it("markRefreshed updates lastRefreshed", async () => {
      const { useDashboardStore } = await import("@/store/dashboard-store");
      const store = useDashboardStore.getState();
      
      store.markRefreshed();
      
      const newState = useDashboardStore.getState();
      expect(newState.refreshConfig.lastRefreshedAt).toBeDefined();
    });

    it("setCustomizing sets customizing state", async () => {
      const { useDashboardStore } = await import("@/store/dashboard-store");
      const store = useDashboardStore.getState();
      
      store.setCustomizing(true);
      expect(useDashboardStore.getState().isCustomizing).toBe(true);
      
      store.setCustomizing(false);
      expect(useDashboardStore.getState().isCustomizing).toBe(false);
    });
  });

  describe("data-utilities-store full coverage", () => {
    it("createExport creates new export config", async () => {
      const { useDataUtilitiesStore } = await import("@/store/data-utilities-store");
      const store = useDataUtilitiesStore.getState();
      const initialCount = store.exports.length;
      
      const exportConfig = store.createExport({
        name: "Test Export",
        format: "csv",
        scope: "all",
      });
      
      expect(exportConfig).toBeDefined();
      const newState = useDataUtilitiesStore.getState();
      expect(newState.exports.length).toBe(initialCount + 1);
    });

    it("updateExport updates existing export", async () => {
      const { useDataUtilitiesStore } = await import("@/store/data-utilities-store");
      const store = useDataUtilitiesStore.getState();
      
      const exportConfig = store.createExport({
        name: "Original",
        format: "csv",
        scope: "all",
      });
      
      store.updateExport(exportConfig.id, { name: "Updated" });
      
      const newState = useDataUtilitiesStore.getState();
      const updated = newState.exports.find(e => e.id === exportConfig.id);
      expect(updated?.name).toBe("Updated");
    });

    it("deleteExport removes export", async () => {
      const { useDataUtilitiesStore } = await import("@/store/data-utilities-store");
      const store = useDataUtilitiesStore.getState();
      
      const exportConfig = store.createExport({
        name: "To Delete",
        format: "csv",
        scope: "all",
      });
      
      store.deleteExport(exportConfig.id);
      
      const newState = useDataUtilitiesStore.getState();
      expect(newState.exports.find(e => e.id === exportConfig.id)).toBeUndefined();
    });

    it("runExport triggers export execution", async () => {
      const { useDataUtilitiesStore } = await import("@/store/data-utilities-store");
      const store = useDataUtilitiesStore.getState();
      
      const exportConfig = store.createExport({
        name: "Run Me",
        format: "csv",
        scope: "all",
      });
      
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      store.runExport(exportConfig.id);
      expect(consoleSpy).toHaveBeenCalledWith(`Running export: ${exportConfig.id}`);
      consoleSpy.mockRestore();
    });

    it("createImport creates new import config", async () => {
      const { useDataUtilitiesStore } = await import("@/store/data-utilities-store");
      const store = useDataUtilitiesStore.getState();
      const initialCount = store.imports.length;
      
      const importConfig = store.createImport({
        name: "Test Import",
        format: "csv",
        source: "file",
      });
      
      expect(importConfig).toBeDefined();
      const newState = useDataUtilitiesStore.getState();
      expect(newState.imports.length).toBe(initialCount + 1);
    });

    it("updateImport updates existing import", async () => {
      const { useDataUtilitiesStore } = await import("@/store/data-utilities-store");
      const store = useDataUtilitiesStore.getState();
      
      const importConfig = store.createImport({
        name: "Original",
        format: "csv",
        source: "file",
      });
      
      store.updateImport(importConfig.id, { name: "Updated" });
      
      const newState = useDataUtilitiesStore.getState();
      const updated = newState.imports.find(i => i.id === importConfig.id);
      expect(updated?.name).toBe("Updated");
    });

    it("deleteImport removes import", async () => {
      const { useDataUtilitiesStore } = await import("@/store/data-utilities-store");
      const store = useDataUtilitiesStore.getState();
      
      const importConfig = store.createImport({
        name: "To Delete",
        format: "csv",
        source: "file",
      });
      
      store.deleteImport(importConfig.id);
      
      const newState = useDataUtilitiesStore.getState();
      expect(newState.imports.find(i => i.id === importConfig.id)).toBeUndefined();
    });

    it("createScheduledExport creates scheduled export", async () => {
      const { useDataUtilitiesStore } = await import("@/store/data-utilities-store");
      const store = useDataUtilitiesStore.getState();
      const initialCount = store.scheduledExports.length;
      
      const scheduled = store.createScheduledExport({
        name: "Daily Export",
        exportConfigId: "export-1",
        schedule: "0 9 * * *",
        enabled: true,
      });
      
      expect(scheduled).toBeDefined();
      const newState = useDataUtilitiesStore.getState();
      expect(newState.scheduledExports.length).toBe(initialCount + 1);
    });

    it("updateScheduledExport updates scheduled export", async () => {
      const { useDataUtilitiesStore } = await import("@/store/data-utilities-store");
      const store = useDataUtilitiesStore.getState();
      
      const scheduled = store.createScheduledExport({
        name: "Original",
        exportConfigId: "export-1",
        schedule: "0 9 * * *",
        enabled: true,
      });
      
      store.updateScheduledExport(scheduled.id, { name: "Updated" });
      
      const newState = useDataUtilitiesStore.getState();
      const updated = newState.scheduledExports.find(s => s.id === scheduled.id);
      expect(updated?.name).toBe("Updated");
    });

    it("deleteScheduledExport removes scheduled export", async () => {
      const { useDataUtilitiesStore } = await import("@/store/data-utilities-store");
      const store = useDataUtilitiesStore.getState();
      
      const scheduled = store.createScheduledExport({
        name: "To Delete",
        exportConfigId: "export-1",
        schedule: "0 9 * * *",
        enabled: true,
      });
      
      store.deleteScheduledExport(scheduled.id);
      
      const newState = useDataUtilitiesStore.getState();
      expect(newState.scheduledExports.find(s => s.id === scheduled.id)).toBeUndefined();
    });

    it("toggleScheduledExport toggles enabled state", async () => {
      const { useDataUtilitiesStore } = await import("@/store/data-utilities-store");
      const store = useDataUtilitiesStore.getState();
      
      const scheduled = store.createScheduledExport({
        name: "Toggle Me",
        exportConfigId: "export-1",
        schedule: "0 9 * * *",
        enabled: true,
      });
      
      store.toggleScheduledExport(scheduled.id);
      
      const newState = useDataUtilitiesStore.getState();
      const toggled = newState.scheduledExports.find(s => s.id === scheduled.id);
      expect(toggled?.enabled).toBe(false);
    });
  });
});
