import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const e2eDbPath = path.join(os.tmpdir(), `vyumi-e2e-${Date.now()}.sqlite`);

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    extraHTTPHeaders:{Origin:'http://localhost:5173'},
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'node src/server.js',
      cwd: path.resolve(__dirname, 'backend'),
      port: 3001,
      reuseExistingServer: !process.env.CI,
      env: {
        PORT: '3001',
        NODE_ENV: 'test',
        DATABASE_PATH: e2eDbPath,
      },
    },
    {
      command: 'npm run dev -- --port 5173',
      cwd: path.resolve(__dirname, 'frontend'),
      port: 5173,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
