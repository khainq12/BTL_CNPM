import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { as, boot, intake, resetTokens } from './helpers'

let ctx: Awaited<ReturnType<typeof boot>>
beforeAll(async () => {
  resetTokens()
  ctx = await boot()
})
afterAll(async () => {
  await ctx.app.close()
})

const newCase = async () => {
  const r = await as(ctx.http, 'tiepnhan').post('/cases', intake(), { 'Idempotency-Key': `c-${Date.now()}-${Math.random()}` })
  expect(r.status).toBe(201)
  return r.body as { id: string; code: string; version: number }
}

describe('Đồng thời và nhất quán (NFR-02)', () => {
  it('TC-049 | hai người cùng thao tác một phiếu với cùng version: một thành công, một nhận 409', async () => {
    const c = await newCase()
    const [a, b] = await Promise.all([
      as(ctx.http, 'cskh').put(`/cases/${c.id}/precheck`, { version: c.version, warranty: 'CON_HAN', note: 'A' }),
      as(ctx.http, 'tiepnhan').post(`/cases/${c.id}/cancel-request`, { version: c.version, reason: 'B' }),
    ])
    expect([a.status, b.status].sort()).toEqual([200, 409])
    const row = await ctx.prisma.warrantyCase.findUnique({ where: { id: c.id } })
    expect(row!.version).toBe(c.version + 1)
  })

  it('TC-027 | hai lần phân công đồng thời một phiếu: chỉ một lần được ghi', async () => {
    const c = await newCase()
    const p = await as(ctx.http, 'cskh').put(`/cases/${c.id}/precheck`, { version: c.version, warranty: 'CON_HAN', note: '' })
    const [a, b] = await Promise.all(
      ['u-ktv1', 'u-ktv2'].map((techId) => as(ctx.http, 'dieuphoi').put(`/cases/${c.id}/diagnosis-assignment`, { version: p.body.version, techId }))
    )
    expect([a.status, b.status].sort()).toEqual([200, 409])
  })

  it('TC-003 | gửi trùng song song cùng Idempotency-Key chỉ tạo một phiếu', async () => {
    const body = intake()
    const key = `dup-${Date.now()}`
    const before = await ctx.prisma.warrantyCase.count()
    const rs = await Promise.all([1, 2, 3].map(() => as(ctx.http, 'tiepnhan').post('/cases', body, { 'Idempotency-Key': key })))
    expect(rs.every((r) => r.status === 201)).toBe(true)
    expect(new Set(rs.map((r) => r.body.id)).size).toBe(1)
    expect(await ctx.prisma.warrantyCase.count()).toBe(before + 1)
  })

  it('TC-021 TC-050 | hai lệnh cùng giữ linh kiện cuối cùng: chỉ một lệnh giữ được, tồn không âm', async () => {
    const part = await ctx.prisma.part.findUnique({ where: { id: 'p3' } })
    const free = part!.onHand - part!.reserved
    const wos: string[] = []
    for (let i = 0; i < free + 1; i++) {
      const c = await newCase()
      let v = c.version
      const step = async (r: Promise<{ status: number; body: { version: number } }>) => {
        const x = await r
        expect(x.status, JSON.stringify(x.body)).toBe(200)
        v = x.body.version
      }
      await step(as(ctx.http, 'cskh').put(`/cases/${c.id}/precheck`, { version: v, warranty: 'CON_HAN', note: '' }))
      await step(as(ctx.http, 'dieuphoi').put(`/cases/${c.id}/diagnosis-assignment`, { version: v, techId: 'u-ktv1' }))
      await step(
        as(ctx.http, 'ktv.an').put(`/cases/${c.id}/diagnosis`, {
          version: v,
          cause: 'Pin phồng',
          causeType: 'PHAN_CUNG',
          severity: 'NHE',
          repairable: true,
          plan: 'Thay pin',
          tasks: [{ title: 'Thay pin', minutes: 20 }],
          parts: [{ partId: 'p3', qty: 1 }],
          laborEstimate: 0,
        })
      )
      await step(as(ctx.http, 'cskh').put(`/cases/${c.id}/eligibility`, { version: v, decision: 'MIEN_PHI', ruleCode: 'D1', reason: 'Còn hạn' }))
      const d = await as(ctx.http, 'quanly').get(`/cases/${c.id}`)
      wos.push(d.body.workOrder.id)
    }
    const rs = await Promise.all(wos.map((w) => as(ctx.http, 'kho').post(`/work-orders/${w}/reserve`)))
    expect(rs.filter((r) => r.status === 204)).toHaveLength(free)
    expect(rs.filter((r) => r.status === 422)).toHaveLength(1)
    const after = await ctx.prisma.part.findUnique({ where: { id: 'p3' } })
    expect(after!.reserved).toBe(after!.onHand)
  })
})

describe('Transactional Outbox (thiết kế Event Handler)', () => {
  it('TC-051 | phiếu và sự kiện CaseCreated được ghi cùng nhau; lệnh bị từ chối không để lại sự kiện', async () => {
    const before = await ctx.prisma.outboxEvent.count()
    const bad = await as(ctx.http, 'tiepnhan').post('/cases', intake({ photos: [] }), { 'Idempotency-Key': `bad-${Date.now()}` })
    expect(bad.status).toBe(422)
    expect(await ctx.prisma.outboxEvent.count()).toBe(before)
    const c = await newCase()
    expect(await ctx.prisma.outboxEvent.count({ where: { aggregateId: c.id, type: 'CaseCreated' } })).toBe(1)
  })

  it('TC-052 | xử lý lại sự kiện đã xử lý không tạo thông báo thứ hai', async () => {
    const c = await newCase()
    await ctx.worker.drain()
    const n1 = await ctx.prisma.notification.count({ where: { caseId: c.id } })
    expect(n1).toBe(1)
    await ctx.prisma.outboxEvent.updateMany({ where: { aggregateId: c.id }, data: { processedAt: null } })
    expect(await ctx.worker.drain()).toBeGreaterThan(0)
    expect(await ctx.prisma.notification.count({ where: { caseId: c.id } })).toBe(n1)
  })

  it('TC-039 | quét SLA sinh cảnh báo nội bộ cho phiếu sắp/quá hạn, quét lại không lặp', async () => {
    const later = Date.now() + 30 * 24 * 3600_000
    const first = await ctx.worker.scanSla(later)
    expect(first).toBeGreaterThan(0)
    expect(await ctx.worker.scanSla(later)).toBe(0)
    const r = await as(ctx.http, 'quanly').get('/notifications/internal')
    expect(r.body.some((n: { message: string }) => /quá hạn/.test(n.message))).toBe(true)
  })
})

describe('Customer Portal API (TV7)', () => {
  const lookup = (code: string, phone: string) => request(ctx.http).post('/api/v1/public/lookup').send({ code, phone })

  it('TC-048 | tra cứu cần cả mã phiếu và SĐT; sai mã hay sai SĐT đều cùng 404', async () => {
    const ok = await lookup('CAS-20261106-0041', '0912345678')
    expect(ok.status).toBe(200)
    expect(ok.body.case).toMatchObject({ code: 'CAS-20261106-0041', stepLabel: 'Đang sửa chữa' })
    const wrongPhone = await lookup('CAS-20261106-0041', '0900000000')
    const wrongCode = await lookup('CAS-20990101-9999', '0912345678')
    expect([wrongPhone.status, wrongCode.status]).toEqual([404, 404])
    expect(wrongPhone.body.message).toBe(wrongCode.body.message)
    expect((await lookup('C02XK1ABJG5H', '0912345678')).status).toBe(404)
  })

  it('TC-047 TC-054 TC-058 | khách không nhận ghi chú nội bộ, người xử lý, trạng thái nội bộ; lịch sử chỉ gồm phiếu của mình', async () => {
    const r = await lookup('CAS-20261106-0041', '0912345678')
    const s = JSON.stringify(r.body)
    expect(s).not.toMatch(/u-ktv|u-cskh|diagnosis|reworkCount|"status"|"by"|passwordHash|0912345678/)
    const own = await ctx.prisma.warrantyCase.findMany({ where: { customer: { phone: '0912345678' } }, select: { code: true } })
    expect(r.body.history.map((h: { code: string }) => h.code).sort()).toEqual(own.map((x) => x.code).sort())
  })

  it('khách gửi yêu cầu trực tuyến → phiếu PENDING_ACCEPT; tiếp nhận thấy và lập biên nhận', async () => {
    const key = `web-${Date.now()}`
    const body = {
      customer: { name: 'Khách Online', phone: '0977123456' },
      device: { kind: 'printer', brand: 'Canon', model: 'LBP2900', serial: `ONL${Date.now()}` },
      symptom: 'Kẹt giấy liên tục',
    }
    const r = await request(ctx.http).post('/api/v1/public/requests').set('Idempotency-Key', key).send(body)
    expect(r.status).toBe(201)
    expect(r.body).toMatchObject({ code: expect.stringMatching(/^CAS-/), status: 'PENDING_ACCEPT' })
    const again = await request(ctx.http).post('/api/v1/public/requests').set('Idempotency-Key', key).send(body)
    expect(again.body.code).toBe(r.body.code)
    const ws = await as(ctx.http, 'tiepnhan').get('/workspace')
    const c = ws.body.cases.find((x: { code: string }) => x.code === r.body.code)
    expect(c).toMatchObject({ status: 'PENDING_ACCEPT', channel: 'ONLINE' })
    const acc = await as(ctx.http, 'tiepnhan').post(`/cases/${c.id}/accept-online`, {
      version: c.version,
      condition: 'Nguyên vẹn',
      accessories: [],
      noAccessories: true,
      photos: [{ name: 'a.jpg' }],
    })
    expect(acc.body.status).toBe('RECEIVED')
  })

  it('TC-008 | khách đồng ý báo giá bằng OTP trên cổng: sai OTP bị từ chối, đúng OTP thì lập lệnh sửa chữa', async () => {
    const c = await ctx.prisma.warrantyCase.findFirst({ where: { status: 'QUOTED' }, include: { customer: true } })
    const base = { code: c!.code, phone: c!.customer.phone, accepted: true }
    expect(
      (
        await request(ctx.http)
          .post('/api/v1/public/quote-response')
          .send({ ...base, otp: '111111' })
      ).status
    ).toBe(422)
    expect(
      (
        await request(ctx.http)
          .post('/api/v1/public/quote-response')
          .send({ ...base, otp: '000000' })
      ).status
    ).toBe(200)
    const after = await ctx.prisma.warrantyCase.findUnique({ where: { id: c!.id } })
    expect(['WO_CREATED', 'READY_TO_REPAIR']).toContain(after!.status)
    await ctx.worker.drain()
    const view = await lookup(c!.code, c!.customer.phone)
    expect(view.body.notifications.length).toBeGreaterThan(0)
  })
})
