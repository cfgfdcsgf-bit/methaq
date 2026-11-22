import { defineConfig, devices } from "@playwright/test";

const port = 4175;
const database = process.env.MEETHAQ_E2E_DATABASE_URL;
if (database && !["127.0.0.1", "localhost", "[::1]"].includes(new URL(database).hostname)) {
  throw new Error("Browser tests require an isolated loopback PostgreSQL database.");
}

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./temp/playwright",
  timeout: 45_000,
  workers: 1,
  use: {
    ...devices["Desktop Chrome"],
    channel: process.env.MEETHAQ_E2E_BROWSER || undefined,
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node dist/index.js",
    url: `http://127.0.0.1:${port}/`,
    env: {
      PORT: String(port),
      NODE_ENV: "production",
      DATABASE_URL: database || "",
      MEETHAQ_SESSION_SECRET: "playwright-isolated-local-server-secret-only",
      MEETHAQ_PUSH_DATA: database ? ".work/e2e-push" : "",
      MEETHAQ_PUSH_VAPID_JSON: "",
      OWNER_EMAIL: "",
      RESEND_API_KEY: "",
    },
  },
});
