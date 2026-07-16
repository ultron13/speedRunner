import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:8787",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Explicitly disable Go API so E2E uses mock auth + local simulation
    command: "npm run dev",
    url: "http://127.0.0.1:8787",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      // Force client demo mode (no Go control plane)
      NEXT_PUBLIC_API_URL: "",
      // Avoid Redis flakiness in CI — in-memory server state
      REDIS_URL: "",
      PORT: "8787",
      WS_PORT: "8788",
    },
  },
});
