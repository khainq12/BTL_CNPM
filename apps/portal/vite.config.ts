import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// @woms/domain trỏ thẳng tới mã nguồn TypeScript dùng chung (không cần build trước).
const domain = fileURLToPath(new URL('../../packages/domain/src/index.ts', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@woms/domain': domain } },
  server: { port: 5174, strictPort: true },
  preview: { port: 4174, strictPort: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    reporters: process.env.CI ? ['default', ['junit', { outputFile: '../../reports/junit/portal.xml', suiteName: 'portal' }]] : ['default'],
  },
})
