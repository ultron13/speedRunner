import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDataUtilitiesStore } from "@/store/data-utilities-store";

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

describe("data utilities store", () => {
  beforeEach(() => {
    localStorageMock.clear();
    useDataUtilitiesStore.setState({
      exports: [],
      imports: [],
      scheduledExports: [],
    });
  });

  it("creates export configurations", () => {
    const exportConfig = useDataUtilitiesStore.getState().createExport({
      name: "Test Export",
      format: "csv",
      dataSource: "runs",
    });

    expect(useDataUtilitiesStore.getState().exports).toHaveLength(1);
    expect(exportConfig.name).toBe("Test Export");
    expect(exportConfig.format).toBe("csv");
  });

  it("updates export configurations", () => {
    const exportConfig = useDataUtilitiesStore.getState().createExport({
      name: "Test Export",
      format: "csv",
      dataSource: "runs",
    });

    useDataUtilitiesStore.getState().updateExport(exportConfig.id, {
      name: "Updated Export",
    });

    expect(useDataUtilitiesStore.getState().exports[0].name).toBe("Updated Export");
  });

  it("deletes export configurations", () => {
    const exportConfig = useDataUtilitiesStore.getState().createExport({
      name: "Test Export",
      format: "csv",
      dataSource: "runs",
    });

    useDataUtilitiesStore.getState().deleteExport(exportConfig.id);
    expect(useDataUtilitiesStore.getState().exports).toHaveLength(0);
  });

  it("creates import configurations", () => {
    const importConfig = useDataUtilitiesStore.getState().createImport({
      name: "Test Import",
      format: "json",
      dataSource: "tests",
    });

    expect(useDataUtilitiesStore.getState().imports).toHaveLength(1);
    expect(importConfig.name).toBe("Test Import");
  });

  it("deletes import configurations", () => {
    const importConfig = useDataUtilitiesStore.getState().createImport({
      name: "Test Import",
      format: "json",
      dataSource: "tests",
    });

    useDataUtilitiesStore.getState().deleteImport(importConfig.id);
    expect(useDataUtilitiesStore.getState().imports).toHaveLength(0);
  });

  it("creates scheduled exports", () => {
    const scheduledExport = useDataUtilitiesStore.getState().createScheduledExport({
      name: "Weekly Export",
      exportConfigId: "exp-1",
      frequency: "weekly",
      destination: "/exports",
      lastExported: null,
      nextExport: new Date().toISOString(),
      enabled: true,
    });

    expect(useDataUtilitiesStore.getState().scheduledExports).toHaveLength(1);
    expect(scheduledExport.name).toBe("Weekly Export");
  });

  it("toggles scheduled exports", () => {
    const scheduledExport = useDataUtilitiesStore.getState().createScheduledExport({
      name: "Daily Export",
      exportConfigId: "exp-1",
      frequency: "daily",
      destination: "/exports",
      lastExported: null,
      nextExport: new Date().toISOString(),
      enabled: true,
    });

    useDataUtilitiesStore.getState().toggleScheduledExport(scheduledExport.id);
    expect(useDataUtilitiesStore.getState().scheduledExports[0].enabled).toBe(false);
  });

  it("deletes scheduled exports", () => {
    const scheduledExport = useDataUtilitiesStore.getState().createScheduledExport({
      name: "Monthly Export",
      exportConfigId: "exp-1",
      frequency: "monthly",
      destination: "/exports",
      lastExported: null,
      nextExport: new Date().toISOString(),
      enabled: true,
    });

    useDataUtilitiesStore.getState().deleteScheduledExport(scheduledExport.id);
    expect(useDataUtilitiesStore.getState().scheduledExports).toHaveLength(0);
  });
});
