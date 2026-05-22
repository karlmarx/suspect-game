import { defineConfig, devices } from "@playwright/test";

/**
 * Production smoke-test config — runs the same multiplayer specs against a
 * live URL (default: https://suspect.93.fyi). No webServer; assumes the
 * target is already deployed.
 *
 * Usage:
 *   npx playwright test -c playwright.prod.config.ts
 *   PROD_BASE_URL=https://suspect-game-xxx.vercel.app npx playwright test -c playwright.prod.config.ts
 */
const baseURL = process.env.PROD_BASE_URL ?? "https://suspect.93.fyi";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 2,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
