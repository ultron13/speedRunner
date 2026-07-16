import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Store Branch Coverage", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe("dashboard-store branches", () => {
    it("handles toggleSectionCollapsed", async () => {
      const { useDashboardStore } = await import("@/store/dashboard-store");
      const store = useDashboardStore.getState();
      const initialCollapsed = store.sections[0]?.collapsed ?? false;
      
      store.toggleSectionCollapsed(store.sections[0].id);
      
      const newState = useDashboardStore.getState();
      expect(newState.sections[0].collapsed).toBe(!initialCollapsed);
    });

    it("handles selectSectionVisible", async () => {
      const { useDashboardStore, selectSectionVisible } = await import("@/store/dashboard-store");
      const store = useDashboardStore.getState();
      const sectionId = store.sections[0].id;
      
      const selector = selectSectionVisible(sectionId);
      const result = selector(useDashboardStore.getState());
      
      expect(typeof result).toBe("boolean");
    });

    it("handles selectSectionCollapsed", async () => {
      const { useDashboardStore, selectSectionCollapsed } = await import("@/store/dashboard-store");
      const store = useDashboardStore.getState();
      const sectionId = store.sections[0].id;
      
      const selector = selectSectionCollapsed(sectionId);
      const result = selector(useDashboardStore.getState());
      
      expect(typeof result).toBe("boolean");
    });
  });

  describe("test-store branches", () => {
    it("handles createTest", async () => {
      vi.stubGlobal("WebSocket", vi.fn().mockImplementation(() => ({
        send: vi.fn(),
        close: vi.fn(),
        onopen: null,
        onmessage: null,
        onclose: null,
        readyState: 1,
      })));

      const { useTestStore } = await import("@/store/test-store");
      const store = useTestStore.getState();
      const initialCount = store.tests.length;
      
      store.createTest({
        name: "Branch Test",
        scriptType: "HTTP",
        targetUrl: "http://test.com",
        virtualUsers: 10,
      });
      
      const newState = useTestStore.getState();
      expect(newState.tests.length).toBe(initialCount + 1);
    });

    it("handles deleteTest", async () => {
      vi.stubGlobal("WebSocket", vi.fn().mockImplementation(() => ({
        send: vi.fn(),
        close: vi.fn(),
        onopen: null,
        onmessage: null,
        onclose: null,
        readyState: 1,
      })));

      const { useTestStore } = await import("@/store/test-store");
      const store = useTestStore.getState();
      
      store.createTest({
        name: "Delete Me",
        scriptType: "HTTP",
        targetUrl: "http://test.com",
        virtualUsers: 10,
      });
      
      const newState = useTestStore.getState();
      const testId = newState.tests[newState.tests.length - 1]?.id;
      
      if (testId) {
        store.deleteTest(testId);
        const finalState = useTestStore.getState();
        expect(finalState.tests.find(t => t.id === testId)).toBeUndefined();
      }
    });

    it("handles tick with running tests", async () => {
      vi.stubGlobal("WebSocket", vi.fn().mockImplementation(() => ({
        send: vi.fn(),
        close: vi.fn(),
        onopen: null,
        onmessage: null,
        onclose: null,
        readyState: 1,
      })));

      const { useTestStore } = await import("@/store/test-store");
      const store = useTestStore.getState();
      
      store.createTest({
        name: "Tick Test",
        scriptType: "HTTP",
        targetUrl: "http://test.com",
        virtualUsers: 10,
      });
      
      const newState = useTestStore.getState();
      const testId = newState.tests[newState.tests.length - 1]?.id;
      
      if (testId) {
        store.startTest(testId);
        store.tick();
        
        const finalState = useTestStore.getState();
        const test = finalState.tests.find(t => t.id === testId);
        expect(test?.status).toBe("running");
      }
    });

    it("handles stopTest", async () => {
      vi.stubGlobal("WebSocket", vi.fn().mockImplementation(() => ({
        send: vi.fn(),
        close: vi.fn(),
        onopen: null,
        onmessage: null,
        onclose: null,
        readyState: 1,
      })));

      const { useTestStore } = await import("@/store/test-store");
      const store = useTestStore.getState();
      
      store.createTest({
        name: "Stop Test",
        scriptType: "HTTP",
        targetUrl: "http://test.com",
        virtualUsers: 10,
      });
      
      const newState = useTestStore.getState();
      const testId = newState.tests[newState.tests.length - 1]?.id;
      
      if (testId) {
        store.startTest(testId);
        store.stopTest(testId);
        
        const finalState = useTestStore.getState();
        const test = finalState.tests.find(t => t.id === testId);
        expect(test?.status).toBe("stopped");
      }
    });
  });
});
