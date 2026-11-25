import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { as, boot, intake, QC_LAPTOP, resetTokens } from './helpers'

let ctx: Awaited<ReturnType<typeof boot>>
beforeAll(async () => {
  resetTokens()
  ctx = await boot()
})
afterAll(async () => {
  await ctx.app.close()
})

// Kịch bản đầu-cuối ở tầng API: một phiếu đi hết quy trình 6.1 với linh kiện, mỗi bước đúng vai trò, kiểm tra CSDL sau cùng.
describe('Luồng chính: tiếp nhận → chẩn đoán → bảo hành miễn phí → kho → sửa → QC → bàn giao', () => {
  const s = { id: '', v: 0, wo: '' }
  const ok = (r: { status: number; body: { version?: number; status?: string; message?: unknown } }, status?: string) => {
    expect(r.status, JSON.stringify(r.body)).toBeLessThan(300)
    if (r.body?.version) s.v = r.body.version
    if (status) expect(r.body.status).toBe(status)
  }
  const refresh = async () => {
    const r = await as(ctx.http, 'quanly').get(`/cases/${s.id}`)
    s.v = r.body.case.version
    s.wo = r.body.workOrder?.id ?? ''
    return r.body
  }

  it('TC-001 | tiếp nhận tạo phiếu RECEIVED', async () => {
    const r = await as(ctx.http, 'tiepnhan').post('/cases', intake(), { 'Idempotency-Key': `flow-${Date.now()}` })
    expect(r.status).toBe(201)
    expect(r.body.code).toMatch(/^CAS-\d{8}-\d{4}$/)
    s.id = r.body.id
    ok(r, 'RECEIVED')
  })

  it('CSKH kiểm tra sơ bộ, điều phối giao chẩn đoán, KTV nộp biên bản (C03)', async () => {
    ok(await as(ctx.http, 'cskh').put(`/cases/${s.id}/precheck`, { version: s.v, warranty: 'CON_HAN', note: 'Tem còn, hóa đơn hợp lệ' }), 'PRECHECK')
    ok(await as(ctx.http, 'dieuphoi').put(`/cases/${s.id}/diagnosis-assignment`, { version: s.v, techId: 'u-ktv1' }), 'DIAGNOSING')
    ok(
      await as(ctx.http, 'ktv.an').put(`/cases/${s.id}/diagnosis`, {
        version: s.v,
        cause: 'Hỏng SSD',
        causeType: 'PHAN_CUNG',
        severity: 'TRUNG_BINH',
        repairable: true,
        plan: 'Thay SSD, cài lại hệ điều hành',
        tasks: [
          { title: 'Thay SSD', minutes: 30 },
          { title: 'Cài hệ điều hành', minutes: 60 },
        ],
        parts: [{ partId: 'p2', qty: 1 }],
        laborEstimate: 0,
      }),
      'ELIGIBILITY_REVIEW'
    )
  })

  it('TC-007 TC-016 | CSKH kết luận miễn phí D1 → tự lập lệnh sửa chữa', async () => {
    ok(
      await as(ctx.http, 'cskh').put(`/cases/${s.id}/eligibility`, { version: s.v, decision: 'MIEN_PHI', ruleCode: 'D1', reason: 'Lỗi phần cứng, còn hạn' }),
      'WO_CREATED'
    )
    const d = await refresh()
    expect(d.workOrder).toMatchObject({ code: expect.stringMatching(/^WO-/), tasks: expect.any(Array) })
  })

  it('TC-020 TC-024 TC-022 | kho giữ linh kiện, điều phối giao sửa, kho cấp phát (ghi biến động kho)', async () => {
    const before = await ctx.prisma.part.findUnique({ where: { id: 'p2' } })
    expect((await as(ctx.http, 'kho').post(`/work-orders/${s.wo}/reserve`)).status).toBe(204)
    await refresh()
    ok(await as(ctx.http, 'dieuphoi').put(`/cases/${s.id}/repair-assignment`, { version: s.v, techId: 'u-ktv1' }), 'ASSIGNED')
    expect((await as(ctx.http, 'kho').post(`/work-orders/${s.wo}/issue`)).status).toBe(204)
    const after = await ctx.prisma.part.findUnique({ where: { id: 'p2' } })
    expect(after!.onHand).toBe(before!.onHand - 1)
    expect(after!.reserved).toBe(before!.reserved)
    const moves = await ctx.prisma.stockMove.findMany({ where: { partId: 'p2', woCode: { not: null } }, orderBy: { at: 'asc' } })
    expect(moves.slice(-2).map((m) => m.type)).toEqual(['GIU', 'XUAT'])
  })

  it('TC-018 | KTV bắt đầu sửa; chưa xong hết công việc thì không chuyển QC', async () => {
    await refresh()
    ok(await as(ctx.http, 'ktv.an').post(`/cases/${s.id}/repair/start`, { version: s.v }), 'IN_REPAIR')
    const early = await as(ctx.http, 'ktv.an').post(`/cases/${s.id}/repair/finish`, { version: s.v, used: {}, note: '' })
    expect(early.status).toBe(422)
    const d = await refresh()
    for (const t of d.workOrder.tasks)
      expect((await as(ctx.http, 'ktv.an').patch(`/work-orders/${s.wo}/tasks/${encodeURIComponent(t.id)}/toggle`)).status).toBe(204)
    expect((await as(ctx.http, 'ktv.an').post(`/work-orders/${s.wo}/logs`, { text: 'Đã thay SSD 512GB' })).status).toBe(204)
    ok(await as(ctx.http, 'ktv.an').post(`/cases/${s.id}/repair/finish`, { version: s.v, used: {}, note: 'Chạy thử ổn' }), 'TESTING')
  })

  it('TC-031 | chưa QC đạt thì không bàn giao được', async () => {
    const r = await as(ctx.http, 'tiepnhan').post(`/cases/${s.id}/handover`, {
      version: s.v,
      recipientName: 'A',
      recipientPhone: '',
      relation: 'CHINH_CHU',
      idNote: 'CCCD',
      accessoriesOk: true,
      conditionOk: true,
      signed: true,
    })
    expect(r.status).toBe(422)
  })

  it('TC-029 TC-034 | QC đạt theo danh mục bắt buộc, tiếp nhận bàn giao có xác nhận → COMPLETED', async () => {
    ok(await as(ctx.http, 'qc').post(`/cases/${s.id}/qc`, { version: s.v, items: QC_LAPTOP, defect: '' }), 'READY_FOR_DELIVERY')
    ok(
      await as(ctx.http, 'tiepnhan').post(`/cases/${s.id}/handover`, {
        version: s.v,
        recipientName: 'Khách Tích Hợp',
        recipientPhone: '',
        relation: 'CHINH_CHU',
        idNote: 'Đối chiếu CCCD',
        accessoriesOk: true,
        conditionOk: true,
        inspectionFee: 0,
        signed: true,
        rating: 5,
      }),
      'COMPLETED'
    )
  })

  it('TC-043 | lịch sử trạng thái lưu ở bảng case_events (from/to/người/thời điểm), nhật ký ở audit_logs', async () => {
    const events = await ctx.prisma.caseEvent.findMany({ where: { caseId: s.id }, orderBy: { seq: 'asc' } })
    expect(events.filter((e) => e.toStatus).map((e) => e.toStatus)).toEqual([
      'RECEIVED',
      'PRECHECK',
      'DIAGNOSING',
      'ELIGIBILITY_REVIEW',
      'WO_CREATED',
      'READY_TO_REPAIR',
      'ASSIGNED',
      'IN_REPAIR',
      'TESTING',
      'READY_FOR_DELIVERY',
      'COMPLETED',
    ])
    expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i + 1))
    const code = (await ctx.prisma.warrantyCase.findUnique({ where: { id: s.id } }))!.code
    const wo = (await ctx.prisma.workOrder.findUnique({ where: { caseId: s.id } }))!.code
    expect(await ctx.prisma.auditLog.count({ where: { ref: { in: [code, wo] } } })).toBeGreaterThanOrEqual(11)
  })

  it('TC-056 | phiếu đã hoàn tất không thao tác tiếp (không mở lại)', async () => {
    expect((await as(ctx.http, 'cskh').put(`/cases/${s.id}/precheck`, { version: s.v, warranty: 'CON_HAN', note: '' })).status).toBe(422)
  })

  it('TC-035 TC-051 | mỗi chuyển trạng thái có sự kiện outbox; xử lý outbox ghi mốc khởi tạo SLA và thông báo khách', async () => {
    const evs = await ctx.prisma.outboxEvent.findMany({ where: { aggregateId: s.id } })
    expect(evs.filter((e) => e.type === 'CaseCreated')).toHaveLength(1)
    expect(evs.filter((e) => e.type === 'CaseStatusChanged')).toHaveLength(10)
    await ctx.worker.drain()
    const code = (await ctx.prisma.warrantyCase.findUnique({ where: { id: s.id } }))!.code
    expect(await ctx.prisma.auditLog.count({ where: { ref: code, action: { contains: 'SlaStarted' } } })).toBe(1)
    expect(await ctx.prisma.notification.count({ where: { caseId: s.id, channel: 'SMS' } })).toBeGreaterThanOrEqual(5)
  })
})

describe('Quản lý duyệt và bảng điều hành', () => {
  it('BR-07 | báo giá vượt ngưỡng: quản lý duyệt → CSKH gửi khách', async () => {
    const c = await ctx.prisma.warrantyCase.findFirst({ where: { status: 'WAITING_APPROVAL' } })
    const ap = await ctx.prisma.approval.findFirst({ where: { caseId: c!.id, status: 'CHO_DUYET' } })
    expect((await as(ctx.http, 'quanly').post(`/approvals/${ap!.id}/decision`, { approve: true, note: 'Đồng ý' })).status).toBe(204)
    const after = await ctx.prisma.warrantyCase.findUnique({ where: { id: c!.id } })
    expect(after!.status).toBe('ELIGIBILITY_REVIEW')
    expect((await as(ctx.http, 'quanly').post(`/approvals/${ap!.id}/decision`, { approve: true, note: '' })).status).toBe(409)
  })

  it('TC-057 | GET /reports/dashboard trả chỉ số điều hành cho quản lý', async () => {
    const r = await as(ctx.http, 'quanly').get('/reports/dashboard')
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ openCases: expect.any(Number), sla: expect.any(Object), byStage: expect.any(Array), byTechnician: expect.any(Array) })
    expect(r.body.reworkRate === null || (r.body.reworkRate >= 0 && r.body.reworkRate <= 1)).toBe(true)
  })

  it('quản lý tạo tài khoản mới, tài khoản đăng nhập được bằng mật khẩu mặc định; khóa xong thì token cũ hết hiệu lực', async () => {
    const created = await as(ctx.http, 'quanly').post('/users', { name: 'KTV Mới', username: 'ktv.moi', role: 'KTV', phone: '0901000099', active: true })
    expect(created.status).toBe(201)
    expect(created.body.password).toBe('')
    const t = as(ctx.http, 'ktv.moi')
    expect((await t.get('/workspace')).status).toBe(200)
    expect(
      (await as(ctx.http, 'quanly').put(`/users/${created.body.id}`, { name: 'KTV Mới', username: 'ktv.moi', role: 'KTV', phone: '', active: false })).status
    ).toBe(200)
    expect((await t.get('/workspace')).status).toBe(401)
  })
})
