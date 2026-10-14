import { randomBytes } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs against its own database (`dtst_e2e` by default) on separate ports, so it never touches
 * development data. The admin password is generated per run and only lives in process memory.
 */
const API_PORT = Number(process.env.E2E_API_PORT ?? 4100);
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 5174);
const WEB_URL = `http://localhost:${WEB_PORT}`;

process.env.E2E_ADMIN_EMAIL ??= 'e2e-admin@example.com';
process.env.E2E_ADMIN_PASSWORD ??= `E2e-${randomBytes(12).toString('base64url')}`;

const serverEnv = {
  NODE_ENV: 'development',
  PORT: String(API_PORT),
  MONGODB_URI: process.env.E2E_MONGODB_URI ?? 'mongodb://127.0.0.1:27017/dtst_e2e',
  JWT_SECRET: process.env.E2E_JWT_SECRET ?? randomBytes(32).toString('hex'),
  CORS_ORIGINS: WEB_URL,
  PUBLIC_APP_URL: WEB_URL,
  RATE_LIMIT_ENABLED: 'false',
  LOG_LEVEL: 'warn',
  SEED_ADMIN_EMAIL: process.env.E2E_ADMIN_EMAIL,
  SEED_ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD,
  SEED_ADMIN_NAME: 'E2E Admin',
};

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: WEB_URL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: 'npx tsx src/scripts/seed.ts --reset-admin-password && npx tsx src/server.ts',
      cwd: './server',
      url: `http://localhost:${API_PORT}/api/v1/health`,
      env: serverEnv,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      cwd: './client',
      url: WEB_URL,
      env: { VITE_DEV_API_TARGET: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
