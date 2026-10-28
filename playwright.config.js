import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'

const testDataDirectory = path.resolve('.playwright-data')
const demoMode = process.env.FOLIO_DEMO_MODE === '1'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  reporter: [
    ['list'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['json', { outputFile: 'test-results/demo-results.json' }],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4174',
    launchOptions: demoMode ? { slowMo: 900 } : {},
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node tests/start-server.js',
    url: 'http://127.0.0.1:4174/api/health',
    reuseExistingServer: false,
    env: {
      DATA_DIR: testDataDirectory,
      PORT: '4174',
      ENABLE_DEMO_TEST_RESET: 'true',
    },
    timeout: 30_000,
  },
})
