const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  globalTeardown: './e2e/global-teardown.mjs',
  timeout: 30000,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3310',
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'node e2e/server.mjs',
    url: 'http://127.0.0.1:3310/health',
    reuseExistingServer: !process.env.CI,
    timeout: 30000
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] }
    }
  ]
});
