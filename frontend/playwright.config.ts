import { defineConfig, devices } from '@playwright/test'

// Signal to test files that the suite is running against the mock store
process.env.TEST_MOCK_MODE = 'true'

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
    env: {
      // Force mock mode for tests — override any .env.local values
      VITE_API_BASE_URL: '',
      VITE_OAUTH_SERVICE_URL: '',
      VITE_OIDC_ISSUER: '',
    },
  },
})
