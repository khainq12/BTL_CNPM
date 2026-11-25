import { createRequire } from 'node:module'
import { join } from 'node:path'
import request from 'supertest'

// Kiểm thử tích hợp chạy trên BẢN BUILD (dist/) của API và một CSDL PostgreSQL thật (DATABASE_URL, mặc định woms_test).
// Nạp bằng require của Node để chạy đúng mã CommonJS sẽ triển khai, không qua bộ biến đổi của Vitest.
// Đường dẫn tính từ thư mục apps/api (npm -w chạy script trong thư mục workspace).
const req = createRequire(join(process.cwd(), 'test', 'helpers.ts'))

process.env.NODE_ENV = 'test'
process.env.OUTBOX_POLL_MS = '0'
process.env.SLA_SCAN_MS = '0'
process.env.THROTTLE_DISABLED ??= '1'
process.env.BCRYPT_ROUNDS = '4'
process.env.JWT_SECRET ??= 'test-secret-at-least-16-chars'
process.env.DATABASE_URL ??= 'postgresql://woms:woms@localhost:5433/woms_test?schema=public'

export const PASSWORD = 'Woms@2026'
export type Http = ReturnType<typeof request>

type Booted = {
  app: { close(): Promise<void>; get<T>(t: unknown): T; getHttpServer(): unknown }
  http: Parameters<typeof request>[0]
  prisma: import('@prisma/client').PrismaClient
  worker: { drain(): Promise<number>; scanSla(now?: number): Promise<number> }
}

export async function boot(): Promise<Booted> {
  const { createApp } = req('../dist/app.factory.js')
  const { seed } = req('../dist/seed.js')
  const { PrismaService } = req('../dist/prisma.service.js')
  const { OutboxWorker } = req('../dist/outbox/outbox.worker.js')
  const app = await createApp({ logger: false })
  await app.init()
  const prisma = app.get(PrismaService)
  await seed(prisma, PASSWORD)
  return { app, http: app.getHttpServer(), prisma, worker: app.get(OutboxWorker) }
}

const tokens = new Map<string, string>()
export async function token(http: Booted['http'], username: string) {
  if (tokens.has(username)) return tokens.get(username)!
  const r = await request(http).post('/api/v1/auth/login').send({ username, password: PASSWORD })
  if (r.status !== 200) throw new Error(`Đăng nhập ${username} lỗi ${r.status}: ${JSON.stringify(r.body)}`)
  tokens.set(username, r.body.accessToken)
  return r.body.accessToken as string
}
export const resetTokens = () => tokens.clear()

// Gọi API với vai trò cho trước.
export function as(http: Booted['http'], username: string) {
  const withAuth = async (method: 'get' | 'post' | 'put' | 'patch' | 'delete', url: string, body?: unknown, headers: Record<string, string> = {}) => {
    let r = request(http)
      [method](`/api/v1${url}`)
      .set('Authorization', `Bearer ${await token(http, username)}`)
    for (const [k, v] of Object.entries(headers)) r = r.set(k, v)
    return body === undefined ? r : r.send(body as object)
  }
  return {
    get: (url: string) => withAuth('get', url),
    post: (url: string, body?: unknown, headers?: Record<string, string>) => withAuth('post', url, body ?? {}, headers),
    put: (url: string, body?: unknown) => withAuth('put', url, body ?? {}),
    patch: (url: string, body?: unknown) => withAuth('patch', url, body ?? {}),
    del: (url: string) => withAuth('delete', url),
  }
}

let seq = 0
export const intake = (over: Record<string, unknown> = {}) => ({
  customer: { name: 'Khách Tích Hợp', phone: `09${String(Date.now()).slice(-7)}${seq++ % 10}` },
  device: { kind: 'laptop', brand: 'HP', model: 'ProBook 450', serial: `IT-${Date.now().toString(36)}-${seq++}`.toUpperCase() },
  symptom: 'Không lên nguồn',
  condition: 'Nguyên vẹn',
  accessories: ['Sạc / adapter'],
  noAccessories: false,
  photos: [{ name: 'mat-truoc.jpg' }],
  ...over,
})

export const QC_LAPTOP = [
  'Lên nguồn, khởi động vào hệ điều hành',
  'Lỗi khách báo đã được khắc phục',
  'Màn hình hiển thị bình thường',
  'Bàn phím, touchpad hoạt động',
  'Sạc pin, nhận adapter',
  'Vỏ máy không phát sinh trầy xước mới',
].map((label) => ({ label, mandatory: true, pass: true, note: '' }))
