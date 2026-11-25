import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { as, boot, intake, PASSWORD, resetTokens } from './helpers'

let ctx: Awaited<ReturnType<typeof boot>>
beforeAll(async () => {
  resetTokens()
  ctx = await boot()
})
afterAll(async () => {
  await ctx.app.close()
})

describe('Sức khỏe dịch vụ', () => {
  it('liveness và readiness (kết nối PostgreSQL)', async () => {
    expect((await request(ctx.http).get('/api/v1/health')).body.status).toBe('ok')
    const r = await request(ctx.http).get('/api/v1/health/ready')
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ status: 'ready', database: 'up' })
  })

  it('OpenAPI (Swagger) mô tả các endpoint chính', async () => {
    const r = await request(ctx.http).get('/api/docs/openapi.json')
    expect(r.status).toBe(200)
    expect(Object.keys(r.body.paths)).toEqual(expect.arrayContaining(['/api/v1/cases', '/api/v1/cases/{id}/eligibility', '/api/v1/public/lookup']))
  })
})

describe('Xác thực (NFR-01)', () => {
  it('TC-045 | đăng nhập đúng nhận JWT; thông tin trả về không chứa băm mật khẩu', async () => {
    const r = await request(ctx.http).post('/api/v1/auth/login').send({ username: 'cskh', password: PASSWORD })
    expect(r.status).toBe(200)
    expect(r.body.accessToken).toMatch(/^eyJ/)
    expect(r.body.user).toMatchObject({ username: 'cskh', role: 'CSKH', password: '' })
    expect(JSON.stringify(r.body)).not.toMatch(/\$2[aby]\$/)
  })

  it('TC-045 | sai mật khẩu và sai tên đăng nhập cùng thông báo 401; tài khoản khóa 403', async () => {
    const a = await request(ctx.http).post('/api/v1/auth/login').send({ username: 'cskh', password: 'sai-mat-khau' })
    const b = await request(ctx.http).post('/api/v1/auth/login').send({ username: 'khong-ton-tai', password: 'x' })
    expect([a.status, b.status]).toEqual([401, 401])
    expect(a.body.message).toBe(b.body.message)
    const locked = await request(ctx.http).post('/api/v1/auth/login').send({ username: 'tiepnhan2', password: PASSWORD })
    expect(locked.status).toBe(403)
  })

  it('không có token hoặc token giả thì 401', async () => {
    expect((await request(ctx.http).get('/api/v1/workspace')).status).toBe(401)
    expect((await request(ctx.http).get('/api/v1/workspace').set('Authorization', 'Bearer abc.def.ghi')).status).toBe(401)
  })

  it('đổi mật khẩu: mật khẩu yếu bị từ chối; đổi xong đăng nhập bằng mật khẩu mới', async () => {
    const kho = as(ctx.http, 'kho')
    expect((await kho.post('/auth/change-password', { current: PASSWORD, next: '123' })).status).toBe(422)
    expect((await kho.post('/auth/change-password', { current: 'sai', next: 'MatKhau2026' })).status).toBe(422)
    expect((await kho.post('/auth/change-password', { current: PASSWORD, next: 'MatKhau2026' })).status).toBe(204)
    expect((await request(ctx.http).post('/api/v1/auth/login').send({ username: 'kho', password: 'MatKhau2026' })).status).toBe(200)
    expect((await kho.post('/auth/change-password', { current: 'MatKhau2026', next: PASSWORD })).status).toBe(204)
  })

  it('NFR-01 | đăng nhập sai liên tục bị giới hạn (429)', async () => {
    process.env.THROTTLE_DISABLED = '0'
    try {
      const codes: number[] = []
      for (let i = 0; i < 12; i++) codes.push((await request(ctx.http).post('/api/v1/auth/login').send({ username: 'quanly', password: 'sai' })).status)
      expect(codes).toContain(429)
    } finally {
      process.env.THROTTLE_DISABLED = '1'
    }
  })
})

describe('Phân quyền (RBAC, ma trận 5.3)', () => {
  it('TC-045 | vai trò không đúng bị chặn ở API (403), kể cả khi tự gọi API không qua giao diện', async () => {
    expect((await as(ctx.http, 'ktv.an').post('/cases', intake(), { 'Idempotency-Key': 'rbac-1' })).status).toBe(403)
    const ap = await ctx.prisma.approval.findFirst({ where: { status: 'CHO_DUYET' } })
    expect((await as(ctx.http, 'cskh').post(`/approvals/${ap!.id}/decision`, { approve: true, note: '' })).status).toBe(403)
    expect((await as(ctx.http, 'cskh').get('/audit')).status).toBe(403)
    expect((await as(ctx.http, 'tiepnhan').post('/users', { name: 'X', username: 'xx1', role: 'QL', phone: '' })).status).toBe(403)
  })

  it('TC-046 | KTV mở phiếu không được giao bị 403; danh sách làm việc không chứa phiếu đó', async () => {
    const c = await ctx.prisma.warrantyCase.findFirst({ where: { status: 'DIAGNOSING' } })
    const assigned = (c!.data as { diagnosisTechId: string }).diagnosisTechId
    const other = assigned === 'u-ktv1' ? 'ktv.binh' : 'ktv.an'
    const mine = assigned === 'u-ktv1' ? 'ktv.an' : 'ktv.binh'
    expect((await as(ctx.http, other).get(`/cases/${c!.id}`)).status).toBe(403)
    expect((await as(ctx.http, mine).get(`/cases/${c!.id}`)).status).toBe(200)
    const ws = await as(ctx.http, other).get('/workspace')
    expect(ws.body.cases.some((x: { id: string }) => x.id === c!.id)).toBe(false)
  })

  it('TC-054 | KTV/kho/QC không nhận SĐT, email khách; không ai nhận băm mật khẩu', async () => {
    for (const u of ['ktv.an', 'kho', 'qc']) {
      const r = await as(ctx.http, u).get('/workspace')
      expect(r.status).toBe(200)
      for (const c of r.body.customers) {
        expect(c.phone).toMatch(/^•+\d{3}$/)
        expect(c.email).toBeUndefined()
      }
      expect(r.body.audit).toHaveLength(0)
      expect(JSON.stringify(r.body)).not.toMatch(/\$2[aby]\$/)
    }
    const ql = await as(ctx.http, 'quanly').get('/workspace')
    expect(ql.body.audit.length).toBeGreaterThan(0)
  })
})

describe('Kiểm tra dữ liệu đầu vào', () => {
  it('sai kiểu dữ liệu trả 400 kèm trường lỗi; vi phạm quy tắc nghiệp vụ trả 422', async () => {
    const bad = await as(ctx.http, 'tiepnhan').post('/cases', { ...intake(), device: { kind: 'tablet' } }, { 'Idempotency-Key': 'v-1' })
    expect(bad.status).toBe(400)
    expect(bad.body.code).toBe('VALIDATION')
    const rule = await as(ctx.http, 'tiepnhan').post('/cases', intake({ symptom: '   ' }), { 'Idempotency-Key': 'v-2' })
    expect(rule.status).toBe(422)
    expect(rule.body).toMatchObject({ code: 'BUSINESS_RULE', message: expect.stringMatching(/lỗi/) })
  })

  it('TC-002 | thiếu mã chống gửi trùng (Idempotency-Key) thì từ chối', async () => {
    expect((await as(ctx.http, 'tiepnhan').post('/cases', intake())).status).toBe(422)
  })

  it('không ghi đè được trường hệ thống (người thao tác, thời điểm) bằng cách gửi thêm khóa lạ', async () => {
    const created = await as(ctx.http, 'tiepnhan').post('/cases', intake(), { 'Idempotency-Key': `mass-${Date.now()}` })
    const r = await as(ctx.http, 'cskh').put(`/cases/${created.body.id}/precheck`, {
      version: created.body.version,
      warranty: 'CON_HAN',
      note: 'ok',
      by: 'u-ql',
      at: '2000-01-01',
    })
    expect(r.status).toBe(200)
    const row = await ctx.prisma.warrantyCase.findUnique({ where: { id: created.body.id } })
    expect((row!.data as { precheck: { by: string; at: string } }).precheck.by).toBe('u-cskh')
    expect((row!.data as { precheck: { at: string } }).precheck.at).not.toMatch(/^2000/)
  })
})
