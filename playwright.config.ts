import { defineConfig, devices } from "@playwright/test";

/**
 * Acceptance suite. Runs against the deployed app named by E2E_BASE_URL or SITE_URL (the staging
 * runtime .env on the Test Server). There is no built-in web server: the suite never silently
 * falls back to a local fixture.
 */
const baseURL = (process.env.E2E_BASE_URL || process.env.SITE_URL || "").replace(/\/+$/, "");
if (!/^https?:\/\//.test(baseURL)) {
  throw new Error("Set SITE_URL (or E2E_BASE_URL) to the deployed app origin before running the acceptance suite.");
}

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["junit", { outputFile: "test-results/e2e-junit.xml" }],
  ],
  outputDir: "test-results/e2e-artifacts",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
});
