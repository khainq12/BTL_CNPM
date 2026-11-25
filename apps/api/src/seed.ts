import { PrismaClient } from '@prisma/client'
import { createSeedDb, DEMO_PASSWORD, emptyDb } from '@woms/domain'
import bcrypt from 'bcryptjs'
import { StateStore } from './store/state-store'

// Nạp dữ liệu mẫu (cùng bộ với bản chạy thử của frontend). Dùng cho môi trường dev/test/demo, KHÔNG chạy ở production.
//   node dist/seed.js          xóa dữ liệu nghiệp vụ rồi nạp lại
// Mật khẩu mọi tài khoản mẫu: SEED_PASSWORD hoặc mặc định DEMO_PASSWORD của bản chạy thử.
const TABLES = [
  'notifications',
  'outbox_events',
  'idempotency_keys',
  'audit_logs',
  'stock_moves',
  'complaints',
  'approvals',
  'case_events',
  'work_orders',
  'warranty_cases',
  'devices',
  'customers',
  'parts',
  'holidays',
  'counters',
  'users',
]

export async function seed(prisma: PrismaClient, password = process.env.SEED_PASSWORD || DEMO_PASSWORD) {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED !== '1') throw new Error('Không nạp dữ liệu mẫu ở production (đặt ALLOW_SEED=1 nếu thật sự cần).')
  const db = createSeedDb()
  const hash = await bcrypt.hash(password, 10)
  for (const u of db.users) u.password = hash
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`)
      const store = new StateStore(prisma as never)
      await store.persist(tx, emptyDb(), db)
      // Dữ liệu mẫu không phát thông báo cho khách.
      await tx.outboxEvent.updateMany({ data: { processedAt: new Date() } })
    },
    { timeout: 60_000 }
  )
  return { users: db.users.length, cases: db.cases.length, parts: db.parts.length }
}

if (require.main === module) {
  const prisma = new PrismaClient()
  seed(prisma)
    .then((r) => console.log(`Đã nạp dữ liệu mẫu: ${r.users} tài khoản, ${r.cases} phiếu, ${r.parts} linh kiện.`))
    .catch((e) => {
      console.error(e)
      process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
}
