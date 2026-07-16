import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    exclude: ["e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        // Core library files
        "lib/simulation.ts",
        "lib/validation.ts",
        "lib/export.ts",
        "lib/utils.ts",
        "lib/report-pdf.ts",
        "lib/api-client.ts",
        "data/mock-data.ts",
        // Core stores (tested)
        "store/test-store.ts",
        "store/dashboard-store.ts",
        "store/auth-store.ts",
        "store/api-store.ts",
        "store/benchmark-store.ts",
        "store/data-utilities-store.ts",
        "store/integration-store.ts",
      ],
      exclude: [
        "**/*.test.ts",
        "**/*.spec.ts",
      ],
      thresholds: {
        lines: 85,
        functions: 85,
        statements: 85,
        branches: 70,
      },
    },
  },
});
