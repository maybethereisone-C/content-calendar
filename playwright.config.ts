import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './__tests__/a11y',
  timeout: 30_000,
  use: {
    baseURL: process.env.DASHBOARD_BASE_URL ?? 'https://dashboard.omnicai.online',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 14'] } },
  ],
})
