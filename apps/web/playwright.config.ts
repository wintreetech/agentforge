import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against a local server. By default they use the system's
 * Microsoft Edge (channel "msedge") so no browser download is required;
 * set PW_CHANNEL=chromium after `npx playwright install chromium` to use bundled Chromium.
 */
const channel = process.env.PW_CHANNEL ?? "msedge";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    channel: channel === "chromium" ? undefined : channel,
    trace: "retain-on-failure",
  },
  webServer: process.env.E2E_BASE_URL ? undefined : { command: "npm run dev", url: "http://localhost:3100", reuseExistingServer: true, timeout: 120_000 },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: channel === "chromium" ? undefined : channel, viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: channel === "chromium" ? undefined : channel }, testMatch: /responsive\.spec\.ts/ },
  ],
});
