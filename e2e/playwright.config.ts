import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for VaultSQL workbench E2E tests
 * 
 * These tests run against localhost:8400 and assume:
 * - Dev environment is running (task dev:up:d)
 * - Dev account is seeded (task dev:setup)
 * - Frontend dev server is running (task frontend:dev)
 */
export default defineConfig({
  testDir: './tests',
  
  // Test timeout
  timeout: 30 * 1000,
  
  // Expect timeout for assertions
  expect: {
    timeout: 5000
  },
  
  // Run tests in files in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter to use
  reporter: [
    ['html'],
    ['list']
  ],
  
  // Shared settings for all the projects below
  use: {
    // Base URL for navigation
    baseURL: 'http://localhost:8400',
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Video on failure
    video: 'retain-on-failure',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Uncomment to test on Firefox and WebKit
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Don't start a dev server - we assume it's already running
  // webServer: undefined,
});
