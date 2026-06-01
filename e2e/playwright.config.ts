import { defineConfig, devices } from "@playwright/test";
import path from "path";

const BASE_URL = process.env["E2E_BASE_URL"] ?? "http://localhost:5000";
const ADMIN_AUTH_FILE = path.join(__dirname, "state/admin-auth.json");

export default defineConfig({
  testDir: "./",
  testMatch: "**/*.spec.ts",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  retries: process.env["CI"] ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "e2e/reports", open: "never" }]],

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
    extraHTTPHeaders: {
      "x-e2e-test": "1",
    },
  },

  projects: [
    {
      name: "chromium",
      testIgnore: ["**/admin-rider-sync/**"],
      use: { ...devices["Desktop Chrome"] },
    },

    {
      name: "admin-setup",
      testMatch: "**/setup/admin-auth.setup.ts",
      use: { ...devices["Desktop Chrome"] },
    },

    {
      name: "admin-rider-sync",
      dependencies: ["admin-setup"],
      testMatch: "**/admin-rider-sync/**/*.spec.ts",
      outputDir: "e2e/test-results",
      use: {
        ...devices["Desktop Chrome"],
        storageState: ADMIN_AUTH_FILE,
        screenshot: "only-on-failure",
        video: "off",
      },
    },
  ],
});
