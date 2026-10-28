import { defineConfig, devices } from '@playwright/test'

// End-to-end tests: a real browser uses the app the way a person would.
// Playwright starts the server (port 3100, with its own empty database) and the client (port 5180) itself,
// so the tests do not clash with `npm run dev` on 3000 and 5173.
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'on-failure' }]],

  use: {
    baseURL: 'http://localhost:5180',
    trace: 'on-first-retry',
  },

  // Every test runs on a computer and on a phone, because the screens look different on each
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],

  webServer: [
    {
      command: 'node start-server.js',
      // /api/health answers 503 until the database is connected, so the tests only start when everything is ready
      url: 'http://localhost:3100/api/health',
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -- --port 5180 --strictPort',
      cwd: '../client',
      url: 'http://localhost:5180',
      timeout: 60_000,
      reuseExistingServer: false,
      // The client sends /api and /socket.io to the test server; an empty VITE_API_URL keeps everything on one origin
      env: { API_PROXY_TARGET: 'http://localhost:3100', VITE_API_URL: '' },
    },
  ],
})
