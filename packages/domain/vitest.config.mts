import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    reporters: process.env.CI ? ['default', ['junit', { outputFile: '../../reports/junit/domain.xml', suiteName: 'domain' }]] : ['default'],
    coverage: { provider: 'v8', include: ['src/**'], exclude: ['src/seed.ts'], reporter: ['text-summary', 'html', 'lcov'], reportsDirectory: '../../reports/coverage/domain' },
  },
})
