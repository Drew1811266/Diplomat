import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

const webDir = fileURLToPath(new URL(".", import.meta.url));
const baseURL = "http://127.0.0.1:1420";
const desktopViewport = { width: 1280, height: 720 };
const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL?.trim() || undefined;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.01
    }
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL,
    colorScheme: "light",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    viewport: desktopViewport
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(browserChannel ? { channel: browserChannel } : {}),
        viewport: desktopViewport
      }
    }
  ],
  webServer: {
    command: "corepack pnpm dev --host 127.0.0.1",
    cwd: webDir,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: baseURL
  }
});
