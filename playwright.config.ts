import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against a real Supabase project (the one in .env.local
// locally, or a dedicated test project in CI) seeded with `npm run seed`.
// Accounts come from E2E_* env vars and default to the seeded demo accounts.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1, // tests share one database
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      // Locally, reuse the installed Edge instead of downloading a browser.
      use: { ...devices["Desktop Chrome"], channel: process.env.CI ? undefined : (process.env.E2E_BROWSER_CHANNEL ?? "msedge") },
    },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: "node ./node_modules/next/dist/bin/next dev -p 3000",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
