import { execSync } from 'node:child_process'

// Đưa CSDL kiểm thử về đúng schema (migrate deploy) trước khi chạy. Dữ liệu được nạp lại ở đầu mỗi file (seed).
export default function setup() {
  const url = (process.env.DATABASE_URL ??= 'postgresql://woms:woms@localhost:5433/woms_test?schema=public')
  if (!/test|ci/i.test(url) && process.env.ALLOW_NON_TEST_DB !== '1') throw new Error(`Từ chối chạy kiểm thử trên CSDL không phải CSDL kiểm thử: ${url}`)
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env })
}
