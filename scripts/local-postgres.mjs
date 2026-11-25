// PostgreSQL 17 chạy cục bộ không cần Docker (gói embedded-postgres tải sẵn bản build theo hệ điều hành).
//   npm run db:local              khởi động ở cổng 5433, giữ dữ liệu trong .local-pg/
//   npm run db:local -- --fresh   xóa dữ liệu cũ rồi khởi tạo lại
// Chuỗi kết nối: postgresql://woms:woms@localhost:5433/woms
// Trong CI và docker compose dùng image postgres:17 chính thức thay cho script này.
import EmbeddedPostgres from 'embedded-postgres'
import { existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const dir = resolve(process.env.LOCAL_PG_DIR ?? '.local-pg')
const port = Number(process.env.LOCAL_PG_PORT ?? 5433)
const fresh = process.argv.includes('--fresh')
if (fresh && existsSync(dir)) rmSync(dir, { recursive: true, force: true })

const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'woms', password: 'woms', port, persistent: true,
  // Windows mặc định WIN1252: ép UTF-8 để lưu tiếng Việt.
  initdbFlags: ['--encoding=UTF8', '--locale=C', '--lc-messages=C'],
  onLog: () => {},
})
const initialised = existsSync(resolve(dir, 'PG_VERSION'))
if (!initialised) await pg.initialise()
await pg.start()
for (const name of ['woms', 'woms_test']) {
  try {
    await pg.createDatabase(name)
  } catch {
    /* đã có */
  }
}
console.log(`PostgreSQL sẵn sàng: postgresql://woms:woms@localhost:${port}/woms (và woms_test). Ctrl+C để dừng.`)

const stop = async () => {
  await pg.stop()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
setInterval(() => {}, 1 << 30)
