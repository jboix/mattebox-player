import { defineConfig, devices } from '@playwright/test';

// The demo page in three browsers: the element upgrades and its panels
// render. Stream playback is the engine's E2E suite, not this one. The
// unit and browser tiers run under Vitest.
export default defineConfig({
  testDir: 'test/e2e',
  webServer: {
    command: 'vite build demo && vite preview demo --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: { baseURL: 'http://localhost:4173' },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
