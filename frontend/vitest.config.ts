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
      reporter: ["text", "html", "json-summary"],
      // Enforce 90% on pure domain/core modules. Large UI stores and thin API
      // wrappers are covered by unit + Playwright separately.
      include: [
        "data/mock-data.ts",
        "lib/simulation.ts",
        "lib/validation.ts",
        "lib/export.ts",
        "lib/utils.ts",
        "lib/auth.ts",
        "store/api-store.ts",
        "store/benchmark-store.ts",
        "store/dashboard-store.ts",
        "store/data-utilities-store.ts",
        "store/integration-store.ts",
      ],
      exclude: [
        "**/*.test.ts",
        "**/*.spec.ts",
        "e2e/**",
        "node_modules/**",
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        // Branch coverage is lower on store persistence guards; lines ≥90% enforced.
        branches: 65,
      },
    },
  },
});
