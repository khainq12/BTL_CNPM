// Chạy thử toàn bộ WOMS trên một máy, không cần Docker:
//   npm run demo            PostgreSQL cục bộ + API + giao diện nhân viên + cổng khách hàng
//   npm run demo -- --reset nạp lại dữ liệu mẫu (xóa dữ liệu đã thao tác)
// Ctrl+C để dừng tất cả.
import { PrismaClient } from '@prisma/client'
import EmbeddedPostgres from 'embedded-postgres'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const api = resolve(root, 'apps/api')
const PG_PORT = 5433
const DATABASE_URL = `postgresql://woms:woms@localhost:${PG_PORT}/woms?schema=public`
const reset = process.argv.includes('--reset')
const env = { ...process.env, DATABASE_URL }
const step = (m) => console.log(`\n▶ ${m}`)
const run = (cmd, cwd = root) => {
  const r = spawnSync(cmd, { cwd, env, shell: true, stdio: 'inherit' })
  if (r.status !== 0) throw new Error(`Lỗi khi chạy: ${cmd}`)
}

step('Khởi động PostgreSQL 17 cục bộ (cổng 5433)')
const dir = resolve(root, '.local-pg')
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: 'woms',
  password: 'woms',
  port: PG_PORT,
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C', '--lc-messages=C'],
  onLog: () => {},
})
if (!existsSync(resolve(dir, 'PG_VERSION'))) await pg.initialise()
await pg.start()
for (const name of ['woms', 'woms_test', 'woms_e2e']) await pg.createDatabase(name).catch(() => {})

step('Build package nghiệp vụ và API')
run('npm run build:domain')
run('npm run build -w @woms/api')

step('Áp migration')
run('npx prisma migrate deploy', api)

const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL })
const users = await prisma.user.count()
await prisma.$disconnect()
if (reset || users === 0) {
  step('Nạp dữ liệu mẫu')
  run('node dist/seed.js', api)
}

const children = []
const start = (name, cmd, cwd, extra = {}) => {
  const p = spawn(cmd, { cwd, env: { ...env, ...extra }, shell: true, stdio: ['ignore', 'pipe', 'pipe'] })
  const tag = `[${name}]`.padEnd(8)
  const out = (b) => String(b).split(/\r?\n/).filter(Boolean).forEach((l) => console.log(`${tag} ${l}`))
  p.stdout.on('data', out)
  p.stderr.on('data', out)
  children.push(p)
}
step('Chạy API, giao diện nhân viên, cổng khách hàng')
start('api', 'node dist/main.js', api, { PORT: '3000', OUTBOX_POLL_MS: '2000' })
start('web', 'npx vite --port 5173 --strictPort', resolve(root, 'apps/staff-web'), { VITE_API_URL: 'http://localhost:3000' })
start('portal', 'npx vite --port 5174 --strictPort', resolve(root, 'apps/portal'), { VITE_API_URL: 'http://localhost:3000' })

console.log(`
──────────────────────────────────────────────────────────────
 Giao diện nhân viên : http://localhost:5173   (mật khẩu chung Woms@2026)
     tiepnhan · cskh · dieuphoi · ktv.an · ktv.binh · kho · qc · quanly
 Cổng khách hàng     : http://localhost:5174   (CAS-20261106-0041 / 0912345678, OTP 000000)
 API + Swagger       : http://localhost:3000/api/docs
 Lần đầu Vite cần khoảng 30–60 giây để chuẩn bị. Ctrl+C để dừng tất cả.
──────────────────────────────────────────────────────────────`)

let stopping = false
const stop = async () => {
  if (stopping) return
  stopping = true
  console.log('\nĐang dừng...')
  for (const c of children) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(c.pid), '/T', '/F'], { stdio: 'ignore' })
    else c.kill('SIGTERM')
  }
  await pg.stop().catch(() => {})
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
