import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    channel: 'chrome',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'Chrome Desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'Chrome Mobile', use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium' } },
  ],
})
