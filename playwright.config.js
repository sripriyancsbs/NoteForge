// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Reusable Base URL configured from PLAYWRIGHT_TEST_BASE_URL environment variable.
 * Default local URL: http://localhost:5000
 */
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:5000';

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1, // Sequential execution to maintain clean database state per test
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: BASE_URL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 10000,
  },

  // Projects configured for Chromium
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],

  // Automatic webServer management: starts Flask app if not already running
  webServer: {
    command: '.\\.venv\\Scripts\\python.exe -m flask --app "app.app:create_app()" run --port=5000',
    url: `${BASE_URL}/health`,
    reuseExistingServer: true,
    timeout: 30000,
    env: {
      FLASK_ENV: 'development',
      DATABASE_URL: process.env.DATABASE_URL || 'sqlite:///noteforge_dev.db',
    },
  },
});
