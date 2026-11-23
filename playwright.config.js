const { defineConfig, devices } = require("@playwright/test");

// `npm test` runs Chromium only; `npm run test:all` runs every project.
// CI runs each browser as its own job (see .github/workflows/test.yml).
module.exports = defineConfig({
  testDir: "tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: { trace: "off" },
  // Most tests open the app from file://; tests/hosted.spec.js uses this
  // server to check it also works when hosted.
  webServer: {
    command: "node tests/serve.js",
    url: "http://127.0.0.1:4173/index.html",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
