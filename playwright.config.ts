import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: {
    timeout: 15_000
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'https://heyform.pinyen-no2fa.workers.dev',
    trace: 'retain-on-failure',
    screenshot: 'on',
    video: 'off',
    viewport: { width: 1280, height: 800 }
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
})
