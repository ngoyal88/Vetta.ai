import { defineConfig, devices } from '@playwright/test';

/**
 * Authenticated app E2E — uses VITE_E2E_MOCK_AUTH + Playwright API mocks (no real backend/Firebase).
 * Run: npm run test:e2e
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5174',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --port 5174 --strictPort',
    url: 'http://localhost:5174',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      VITE_E2E_MOCK_AUTH: 'true',
      VITE_REQUIRE_EMAIL_VERIFICATION: 'false',
      VITE_RESUME_BUILDER_ENABLED: 'true',
    },
  },
});
