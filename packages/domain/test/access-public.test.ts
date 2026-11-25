import { beforeEach, describe, expect, it } from 'vitest'
import { canViewCase, workspaceView } from '../src/access'
import * as C from '../src/commands'
import { dashboard } from '../src/dashboard'
import type { Db } from '../src/db'
import { findPublicCase, PUBLIC_STEP_OF, publicHistory, toPublicCase } from '../src/public'
import { canSee } from '../src/roles'
import { CASE_STATUS } from '../src/statuses'
import { Flow, newDb, user } from './flow'

let db: Db
beforeEach(() => {
  db = newDb()
})

describe('Phân quyền xem dữ liệu (NFR-01, AT-14)', () => {
  it('TC-046 | KTV chỉ xem phiếu được giao; kho chỉ xem phiếu đã có lệnh sửa chữa', () => {
    const f = new Flow(db).precheck().assignDiagnosis('u-ktv1')
    expect(canViewCase(user(db, 'ktv.an'), f.case)).toBe(true)
    expect(canViewCase(user(db, 'ktv.binh'), f.case)).toBe(false)
    expect(canViewCase(user(db, 'kho'), f.case)).toBe(false)
    expect(workspaceView(db, user(db, 'ktv.binh')).cases.some((c) => c.id === f.c.id)).toBe(false)
  })

  it('TC-054 | KTV/kho/QC không nhận SĐT, email khách; không ai nhận mật khẩu; nhật ký chỉ quản lý xem', () => {
    for (const u of ['ktv.an', 'kho', 'qc']) {
      const v = workspaceView(db, user(db, u))
      for (const c of v.customers) {
        expect(c.phone).toMatch(/^•+\d{3}$/)
        expect(c.email).toBeUndefined()
      }
      expect(v.audit).toHaveLength(0)
    }
    for (const u of ['tiepnhan', 'cskh', 'quanly']) expect(workspaceView(db, user(db, u)).users.every((x) => x.password === '')).toBe(true)
    expect(workspaceView(db, user(db, 'quanly')).audit.length).toBe(db.audit.length)
    expect(workspaceView(db, user(db, 'tiepnhan')).idempotency).toEqual({})
  })

  it('TC-045 | quyền vào trang theo ma trận 5.3', () => {
    expect(canSee('TN', 'intake')).toBe(true)
    expect(canSee('TN', 'approvals')).toBe(false)
    expect(canSee('KTV', 'users')).toBe(false)
    expect(canSee('QL', 'dashboard')).toBe(true)
    expect(canSee(undefined, 'inbox')).toBe(false)
  })
})

describe('Customer Portal (TV7)', () => {
  const sample = () => db.cases.find((c) => c.code === 'CAS-20261106-0041')!
  const phoneOf = (customerId: string) => db.customers.find((c) => c.id === customerId)!.phone

  it('TC-048 | tra cứu cần đúng cả mã phiếu và SĐT; serial hoặc mã đơn lẻ không tra được', () => {
    const c = sample()
    expect(findPublicCase(db, c.code, phoneOf(c.customerId))?.id).toBe(c.id)
    expect(findPublicCase(db, c.code.toLowerCase(), ` ${phoneOf(c.customerId)} `)?.id).toBe(c.id)
    expect(findPublicCase(db, c.code, '0900000000')).toBeUndefined()
    expect(findPublicCase(db, c.code, '')).toBeUndefined()
    const serial = db.devices.find((d) => d.id === c.deviceId)!.serial
    expect(findPublicCase(db, serial, phoneOf(c.customerId))).toBeUndefined()
  })

  it('TC-047 TC-054 | dữ liệu trả cho khách không có ghi chú nội bộ, người xử lý, SĐT hay trạng thái nội bộ', () => {
    const c = sample()
    const p = toPublicCase(db, c)
    const json = JSON.stringify(p)
    expect(json).not.toMatch(/u-ktv|u-cskh|diagnosis|reworkCount|"status"|0912345678|"by"/)
    expect(Object.keys(p).sort()).toEqual(
      ['code', 'createdAt', 'device', 'eta', 'final', 'note', 'quote', 'receivedAt', 'step', 'stepLabel', 'symptom', 'timeline'].sort()
    )
    expect(p.stepLabel).toBe('Đang sửa chữa')
  })

  it('21 trạng thái đều có bước công khai; bước không lùi trên luồng chính', () => {
    for (const s of Object.keys(CASE_STATUS)) expect(PUBLIC_STEP_OF[s as keyof typeof PUBLIC_STEP_OF]).toBeGreaterThanOrEqual(0)
    const f = new Flow(db).toTesting().qc(true)
    const steps = toPublicCase(db, f.case).timeline.map((t) => t.step)
    expect(steps).toEqual([...steps].sort())
    expect(steps.at(-1)).toBe(4)
  })

  it('TC-058 | lịch sử chỉ gồm phiếu của chính khách đã xác thực', () => {
    const c = sample()
    const own = db.cases.filter((x) => x.customerId === c.customerId).map((x) => x.code)
    expect(
      publicHistory(db, c.customerId)
        .map((x) => x.code)
        .sort()
    ).toEqual(own.sort())
  })

  it('báo giá chỉ hiện cho khách khi đang chờ khách xác nhận', () => {
    const f = new Flow(db).precheck('HET_HAN').assignDiagnosis().diagnose()
    C.decideEligibility(db, user(db, 'cskh'), f.c.id, f.v, {
      decision: 'CO_PHI',
      ruleCode: 'D3',
      reason: 'Hết hạn',
      quote: { items: [{ label: 'IC', qty: 1, unitPrice: 100_000 }], labor: 50_000 },
    })
    expect(toPublicCase(db, f.case).quote).toMatchObject({ total: 150_000 })
    C.recordQuoteResponse(db, user(db, 'cskh'), f.c.id, f.v, { accepted: true, method: 'Gọi điện', note: '' })
    expect(toPublicCase(db, f.case).quote).toBeUndefined()
  })
})

describe('Bảng điều hành (TV7)', () => {
  it('TC-057 | tỷ lệ sửa lại = số phiếu có QC không đạt / số phiếu đã qua QC', () => {
    const base = dashboard(db)
    new Flow(db).toTesting().qc(false, 'Lỗi').start().doTasks().finish().qc(true)
    new Flow(db).toTesting().qc(true)
    const k = dashboard(db)
    const qcd = db.cases.filter((c) => c.qc.length > 0)
    const reworked = qcd.filter((c) => c.reworkCount > 0 || c.qc.some((q) => !q.pass))
    expect(k.reworkRate).toBeCloseTo(reworked.length / qcd.length)
    expect(k.openCases).toBe(base.openCases + 2)
    expect(k.byStage.reduce((s, x) => s + x.count, 0)).toBe(k.openCases)
  })
})
