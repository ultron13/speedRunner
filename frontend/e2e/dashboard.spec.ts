import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/");
  // Wait for login form
  await expect(
    page.getByRole("heading", { name: "SpeedRunner Enterprise" }),
  ).toBeVisible({ timeout: 30_000 });

  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Password").fill("admin123");
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for dashboard shell — not just a summary label (more stable across layouts)
  await expect(
    page.getByRole("heading", { name: "Performance dashboard" }),
  ).toBeVisible({ timeout: 30_000 });

  // Ensure summary cards finished hydrating
  await expect(page.getByLabel("Dashboard summary").getByText("Total Tests")).toBeVisible({
    timeout: 30_000,
  });
}

test.describe("Authentication", () => {
  test("shows login page initially", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "SpeedRunner Enterprise" }),
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill("wrong@example.com");
    await page.getByLabel("Password").fill("wrong");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText("Invalid email or password")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("logs in with valid credentials", async ({ page }) => {
    await login(page);
    await expect(page.getByText("Performance dashboard")).toBeVisible();
  });
});

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("renders the main dashboard shell", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Performance dashboard" }),
    ).toBeVisible();
    await expect(page.getByText("SpeedRunner Enterprise")).toBeVisible();
    await expect(
      page.getByText(
        "Monitor active load tests, response trends, and test infrastructure.",
      ),
    ).toBeVisible();
  });

  test("shows summary cards", async ({ page }) => {
    const summarySection = page.getByLabel("Dashboard summary");
    await expect(summarySection.getByText("Total Tests")).toBeVisible();
    await expect(summarySection.getByText("Running Tests")).toBeVisible();
    await expect(summarySection.getByText("Completed Runs")).toBeVisible();
    await expect(summarySection.getByText("Avg Response Time")).toBeVisible();
  });

  test("shows active tests table with running tests", async ({ page }) => {
    await expect(page.getByText("Active Tests", { exact: true })).toBeVisible();
    const runningCount = await page
      .locator("span")
      .filter({ hasText: /^running$/ })
      .count();
    expect(runningCount).toBeGreaterThanOrEqual(1);
  });

  test("shows recent runs table", async ({ page }) => {
    await expect(page.getByText("Recent Runs")).toBeVisible();
  });

  test("shows infrastructure health cards", async ({ page }) => {
    // Infrastructure is lazy-loaded — scroll into view and wait
    const heading = page.getByRole("heading", { name: "Infrastructure Health" });
    await heading.scrollIntoViewIfNeeded().catch(() => undefined);
    await expect(heading).toBeVisible({ timeout: 30_000 });
    await expect(
      page.locator("[data-slot='card-title']", { hasText: "Controller" }),
    ).toBeVisible();
    await expect(
      page.locator("[data-slot='card-title']", { hasText: "Load Generator" }),
    ).toBeVisible();
    await expect(
      page.locator("[data-slot='card-title']", { hasText: "Database" }),
    ).toBeVisible();
  });

  test("shows trend charts", async ({ page }) => {
    const trendsSection = page.getByRole("region", { name: /performance trends/i });
    await expect(
      trendsSection.getByText("Response Time", { exact: true }).first(),
    ).toBeVisible();
    await expect(trendsSection.getByText("Throughput", { exact: true }).first()).toBeVisible();
  });
});

test.describe("Create Test Modal", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("opens and closes the create test modal", async ({ page }) => {
    await page.getByRole("button", { name: "New Test", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Create a load test")).toBeVisible();

    await page.getByRole("button", { name: /cancel/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("validates required fields", async ({ page }) => {
    await page.getByRole("button", { name: "New Test", exact: true }).click();
    await page.getByRole("button", { name: /create test/i }).click();

    await expect(page.getByText("Enter at least 3 characters.")).toBeVisible();
  });

  test("creates a new test", async ({ page }) => {
    await page.getByRole("button", { name: "New Test", exact: true }).click();
    await page.getByLabel("Test Name").fill("My New Test");
    await page.getByLabel("Target URL").fill("https://api.example.com/test");
    await page.getByLabel("Virtual Users").fill("200");
    await page.getByRole("button", { name: "Create Test" }).click();

    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("My New Test").first()).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe("Test Lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("starts an idle test", async ({ page }) => {
    const runningBefore = await page
      .locator("span")
      .filter({ hasText: /^running$/ })
      .count();
    const idleRow = page.locator("tr").filter({ hasText: "idle" }).first();
    const startButton = idleRow.getByRole("button", { name: /start test/i });
    await expect(startButton).toBeEnabled({ timeout: 5_000 });
    await startButton.click();

    await expect(page.locator("span").filter({ hasText: /^running$/ })).toHaveCount(
      runningBefore + 1,
      { timeout: 10_000 },
    );
  });

  test("stops a running test", async ({ page }) => {
    const stoppedBefore = await page
      .locator("span")
      .filter({ hasText: /^stopped$/ })
      .count();
    const runningRow = page.locator("tr").filter({ hasText: "running" }).first();
    const stopButton = runningRow.getByRole("button", { name: /stop test/i });
    await expect(stopButton).toBeEnabled({ timeout: 10_000 });
    await stopButton.click();

    await expect
      .poll(async () => page.locator("span").filter({ hasText: /^stopped$/ }).count(), {
        timeout: 15_000,
      })
      .toBeGreaterThanOrEqual(stoppedBefore + 1);
  });
});

test.describe("Enterprise navigation", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("navigates to tests page", async ({ page }) => {
    await page.goto("/tests");
    await expect(page.getByRole("heading", { name: "Performance tests" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("navigates to pools page", async ({ page }) => {
    await page.goto("/pools");
    await expect(page.getByRole("heading", { name: "Load generator pools" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("navigates to engines page", async ({ page }) => {
    await page.goto("/engines");
    await expect(page.getByRole("heading", { name: "Multi-engine catalog" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("navigates to reports page", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("navigates to analytics page", async ({ page }) => {
    await page.goto("/analytics", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Performance analytics" })).toBeVisible({
      timeout: 30_000,
    });
  });
});

