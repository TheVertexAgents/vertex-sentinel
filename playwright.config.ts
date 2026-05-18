import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './scripts',
  timeout: 600 * 1000, // 10 minutes for marketing video recording
  expect: {
    timeout: 5000
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    actionTimeout: 0,
    trace: 'on-first-retry',
    video: {
      mode: 'on',
      size: { width: 1920, height: 1080 }
    },
    viewport: { width: 1920, height: 1080 },
    launchOptions: {
      slowMo: 50, // Makes interactions feel more natural/cinematic
    }
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        deviceScaleFactor: 2, // High DPI for crisp text
      },
    },
  ],
});
