import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config();

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,

  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["allure-playwright", { resultsDir: "allure-results" }],
    ["json", { outputFile: "results.json" }],
  ],

  use: {
    baseURL: process.env.BASE_URL || "https://lumina.dev.ops.satnusa.com",
    channel: process.env.BROWSER_CHANNEL || undefined,
    headless: true,
    screenshot: "only-on-failure", //{ mode: "on", fullPage: true }, untuk ss semua testing setelah selesai
    video: "off", //'retain-on-failure'
    trace: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    testIdAttribute: "id",
    launchOptions: { executablePath: "/usr/bin/chromium" },
    ignoreHTTPSErrors: true,
  },

  projects: [
    // 1) Login sekali, simpan sesi ke .auth/user.json
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    // 2) Semua test memakai sesi hasil login di atas
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: ".auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
});
