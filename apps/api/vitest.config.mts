import { defineConfig } from 'vitest/config'

// Kiểm thử tích hợp: cần PostgreSQL (DATABASE_URL). Các file chạy tuần tự vì dùng chung một CSDL kiểm thử.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    reporters: process.env.CI ? ['default', ['junit', { outputFile: '../../reports/junit/api.xml', suiteName: 'api' }]] : ['default'],
  },
})
