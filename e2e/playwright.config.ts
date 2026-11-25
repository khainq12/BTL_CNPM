import { defineConfig, devices } from '@playwright/test'

// Kiểm thử đầu-cuối: dựng toàn bộ hệ thống (API + PostgreSQL + frontend nội bộ + cổng khách hàng) rồi chạy kịch bản
// trên trình duyệt thật. Tham khảo: https://playwright.dev/docs/best-practices, https://playwright.dev/docs/ci
//   DATABASE_URL  CSDL dành riêng cho E2E (mặc định woms_e2e trên PostgreSQL cục bộ cổng 5433). Bị xóa và nạp lại dữ liệu mẫu.
const CI = !!process.env.CI
const API_PORT = 3100
export const API_URL = `http://localhost:${API_PORT}`
const DB = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL ?? 'postgresql://woms:woms@localhost:5433/woms_e2e?schema=public'

export default defineConfig({
  testDir: './tests',
  outputDir: '../reports/playwright-artifacts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    [CI ? 'github' : 'list'],
    ['html', { outputFolder: '../reports/playwright', open: 'never' }],
    ['junit', { outputFile: '../reports/junit/e2e.xml' }],
  ],
  use: {
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
  },
  projects: [
    { name: 'staff-web', testMatch: /staff\..*\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4173' } },
    { name: 'portal', testMatch: /portal\..*\.spec\.ts/, use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4174' } },
    { name: 'portal-mobile', testMatch: /portal\.lookup\.spec\.ts/, use: { ...devices['Pixel 7'], baseURL: 'http://localhost:4174' } },
  ],
  webServer: [
    {
      name: 'api',
      cwd: '../apps/api',
      // Đưa CSDL E2E về schema mới nhất, nạp dữ liệu mẫu, rồi chạy bản build của API.
      command: 'npx prisma migrate deploy && node dist/seed.js && node dist/main.js',
      url: `${API_URL}/api/v1/health/ready`,
      env: {
        DATABASE_URL: DB,
        PORT: String(API_PORT),
        NODE_ENV: 'test',
        JWT_SECRET: 'e2e-secret-at-least-16-chars',
        OUTBOX_POLL_MS: '500',
        SLA_SCAN_MS: '0',
        THROTTLE_DISABLED: '1',
        CORS_ORIGINS: 'http://localhost:4173,http://localhost:4174',
      },
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      name: 'staff-web',
      cwd: '../apps/staff-web',
      command: 'npx vite build --logLevel warn && npx vite preview --port 4173 --strictPort',
      url: 'http://localhost:4173',
      env: { VITE_API_URL: API_URL },
      reuseExistingServer: false,
      timeout: 300_000,
    },
    {
      name: 'portal',
      cwd: '../apps/portal',
      command: 'npx vite build --logLevel warn && npx vite preview --port 4174 --strictPort',
      url: 'http://localhost:4174',
      env: { VITE_API_URL: API_URL },
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
})
