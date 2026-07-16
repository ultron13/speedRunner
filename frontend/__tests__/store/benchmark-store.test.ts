import { beforeEach, describe, expect, it, vi } from "vitest";

import { useBenchmarkStore } from "@/store/benchmark-store";

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

describe("benchmark store", () => {
  beforeEach(() => {
    localStorageMock.clear();
    useBenchmarkStore.setState({
      configs: [],
      results: [],
    });
  });

  it("creates benchmark configurations", () => {
    const config = useBenchmarkStore.getState().createConfig({
      name: "Performance Test",
      description: "Test response time",
      testIds: ["test-1", "test-2"],
      metrics: ["responseTime", "throughput"],
      iterations: 5,
    });

    expect(useBenchmarkStore.getState().configs).toHaveLength(1);
    expect(config.name).toBe("Performance Test");
    expect(config.iterations).toBe(5);
  });

  it("updates benchmark configurations", () => {
    const config = useBenchmarkStore.getState().createConfig({
      name: "Test Benchmark",
      description: "Test",
      testIds: ["test-1"],
      metrics: ["responseTime"],
      iterations: 3,
    });

    useBenchmarkStore.getState().updateConfig(config.id, {
      name: "Updated Benchmark",
    });

    expect(useBenchmarkStore.getState().configs[0].name).toBe("Updated Benchmark");
  });

  it("deletes benchmark configurations", () => {
    const config = useBenchmarkStore.getState().createConfig({
      name: "Test Benchmark",
      description: "Test",
      testIds: ["test-1"],
      metrics: ["responseTime"],
      iterations: 3,
    });

    useBenchmarkStore.getState().deleteConfig(config.id);
    expect(useBenchmarkStore.getState().configs).toHaveLength(0);
  });

  it("runs benchmarks and creates results", () => {
    const config = useBenchmarkStore.getState().createConfig({
      name: "Performance Test",
      description: "Test response time",
      testIds: ["test-1"],
      metrics: ["responseTime", "throughput"],
      iterations: 3,
    });

    const result = useBenchmarkStore.getState().runBenchmark(config.id);

    expect(useBenchmarkStore.getState().results).toHaveLength(1);
    expect(result.testName).toBe("Performance Test");
    expect(result.metrics.responseTime).toBeDefined();
    expect(result.metrics.throughput).toBeDefined();
  });

  it("throws error when running non-existent benchmark", () => {
    expect(() => {
      useBenchmarkStore.getState().runBenchmark("nonexistent");
    }).toThrow("Config not found");
  });
});
