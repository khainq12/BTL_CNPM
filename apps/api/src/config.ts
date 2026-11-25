import { z } from 'zod'

// Cấu hình từ biến môi trường (12-factor). Thiếu biến bắt buộc ở production thì dừng ngay khi khởi động.
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'Thiếu DATABASE_URL (postgresql://user:pass@host:5432/db)'),
  JWT_SECRET: z.string().min(16).optional(),
  JWT_TTL_HOURS: z.coerce.number().positive().default(8),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:4173,http://localhost:5174,http://localhost:4174'),
  OUTBOX_POLL_MS: z.coerce.number().int().min(0).default(2000),
  SLA_SCAN_MS: z.coerce.number().int().min(0).default(300000),
  PORTAL_DEMO_OTP: z.string().default('000000'),
  DEFAULT_PASSWORD: z.string().min(8).default('Woms@2026'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(14).default(10),
  THROTTLE_LOGIN_PER_MIN: z.coerce.number().int().positive().default(10),
  THROTTLE_PUBLIC_PER_MIN: z.coerce.number().int().positive().default(20),
})

export type AppConfig = z.infer<typeof schema> & { JWT_SECRET: string }

let cached: AppConfig | undefined

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (cached) return cached
  const parsed = schema.safeParse(env)
  if (!parsed.success) {
    throw new Error(`Cấu hình không hợp lệ: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`)
  }
  const c = parsed.data
  if (c.NODE_ENV === 'production' && !c.JWT_SECRET) throw new Error('Cấu hình không hợp lệ: production cần JWT_SECRET (tối thiểu 16 ký tự).')
  cached = { ...c, JWT_SECRET: c.JWT_SECRET ?? 'woms-dev-secret-only-for-local-use' }
  return cached
}

export function resetConfigCache() {
  cached = undefined
}

export const CONFIG = Symbol('CONFIG')
