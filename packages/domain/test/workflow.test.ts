import { beforeEach, describe, expect, it } from 'vitest'
import * as C from '../src/commands'
import type { Db } from '../src/db'
import { ApiError } from '../src/errors'
import { PARAMS } from '../src/params'
import { suggestRule } from '../src/rules'
import { TRANSITIONS } from '../src/statuses'
import { Flow, intakeInput, newDb, user } from './flow'

// Kiểm thử quy tắc nghiệp vụ trên lệnh thật (@woms/domain/commands). Tên test gắn mã TC trong bộ 58 TC của nhóm QA (Hoài)
// để báo cáo truy vết (scripts/test-report.mjs) đối chiếu tự động.

const fails = (fn: () => unknown, status: number, msg?: RegExp) => {
  try {
    fn()
  } catch (e) {
    expect(e).toBeInstanceOf(ApiError)
    expect((e as ApiError).status).toBe(status)
    if (msg) expect((e as ApiError).message).toMatch(msg)
    return e as ApiError
  }
  throw new Error(`Lệnh không báo lỗi ${status} như mong đợi`)
}

let db: Db
beforeEach(() => {
  db = newDb()
})

describe('Tiếp nhận (FR-01)', () => {
  it('TC-001 | tạo phiếu với đầy đủ thông tin hợp lệ: mã CAS duy nhất, trạng thái RECEIVED, có lịch sử và nhật ký', () => {
    const before = db.cases.length
    const f = new Flow(db)
    expect(db.cases).toHaveLength(before + 1)
    expect(f.case.code).toMatch(/^CAS-\d{8}-\d{4}$/)
    expect(new Set(db.cases.map((c) => c.code)).size).toBe(db.cases.length)
    expect(f.case.status).toBe('RECEIVED')
    expect(f.case.events.at(-1)).toMatchObject({ action: 'Tạo phiếu tiếp nhận', to: 'RECEIVED' })
    expect(db.audit[0]).toMatchObject({ entity: 'PHIEU', ref: f.case.code })
  })

  it.each([
    ['serial', { device: { ...intakeInput().device, serial: '   ' } }, /serial/i],
    ['serial ký tự vô hình', { device: { ...intakeInput().device, serial: '​​' } }, /serial/i],
    ['mô tả lỗi', { symptom: ' \t ' }, /lỗi/],
    ['họ tên', { customer: { name: '', phone: '0911000001' } }, /họ tên/],
    ['số điện thoại sai định dạng', { customer: { name: 'A', phone: '12345' } }, /10 chữ số/],
    ['ảnh hiện trạng', { photos: [] }, /ảnh/],
    ['tình trạng bên ngoài', { condition: '' }, /tình trạng/],
    ['phụ kiện', { accessories: [], noAccessories: false }, /phụ kiện/],
  ])('TC-002 | bỏ trống/sai %s thì từ chối (422) và không tạo phiếu (QA-DEF-001, QA-DEF-002)', (_name, over, msg) => {
    const before = db.cases.length
    fails(() => C.createCase(db, user(db, 'tiepnhan'), intakeInput(over as never), 'k-1'), 422, msg)
    expect(db.cases).toHaveLength(before)
  })

  it('TC-003 | gửi lại cùng mã chống trùng không tạo phiếu thứ hai (EX-13)', () => {
    const input = intakeInput()
    const a = C.createCase(db, user(db, 'tiepnhan'), input, 'same-key')
    const b = C.createCase(db, user(db, 'tiepnhan'), input, 'same-key')
    expect(b.id).toBe(a.id)
    expect(db.cases.filter((c) => c.id === a.id)).toHaveLength(1)
    fails(() => C.createCase(db, user(db, 'tiepnhan'), input, '  '), 422, /chống gửi trùng/)
  })

  it('TC-005 | serial đã thuộc khách khác thì chặn, chỉ lộ 3 số cuối SĐT chủ máy (QA-DEF-003)', () => {
    const owned = db.devices.find((d) => d.serial === 'C02XK1ABJG5H')!
    const e = fails(
      () => C.createCase(db, user(db, 'tiepnhan'), intakeInput({ device: { ...intakeInput().device, serial: owned.serial.toLowerCase() } }), 'k-5'),
      422,
      /khách khác/
    )
    const ownerPhone = db.customers.find((c) => c.id === owned.customerId)!.phone
    expect(e.message).toContain(ownerPhone.slice(-3))
    expect(e.message).not.toContain(ownerPhone)
    expect(owned.customerId).toBe('c1')
  })

  it('TC-005 | serial đã có của chính khách thì dùng lại thiết bị, không tạo thiết bị trùng', () => {
    const owned = db.devices.find((d) => d.serial === 'C02XK1ABJG5H')!
    const owner = db.customers.find((c) => c.id === owned.customerId)!
    const before = db.devices.length
    const c = C.createCase(
      db,
      user(db, 'tiepnhan'),
      intakeInput({ customer: { name: owner.name, phone: owner.phone }, device: { ...intakeInput().device, serial: owned.serial } }),
      'k-5b'
    )
    expect(c.deviceId).toBe(owned.id)
    expect(db.devices).toHaveLength(before)
  })

  it('TC-045 | vai trò khác tiếp nhận không tạo được phiếu (403)', () => {
    for (const u of ['cskh', 'ktv.an', 'kho', 'qc', 'quanly']) fails(() => C.createCase(db, user(db, u), intakeInput(), `k-${u}`), 403)
  })
})

describe('Điều kiện bảo hành và báo giá (FR-02)', () => {
  it('TC-007 | còn hạn, lỗi trong phạm vi: kết luận miễn phí D1, lập lệnh sửa chữa từ biên bản chẩn đoán', () => {
    const f = new Flow(db).toEligibility().free('D1')
    expect(f.case.eligibility).toMatchObject({ decision: 'MIEN_PHI', ruleCode: 'D1', policyCode: 'BH-TC-2026' })
    expect(f.case.status).toBe('READY_TO_REPAIR')
    expect(f.wo.tasks.map((t) => t.title)).toEqual(['Tháo máy, thay IC nguồn', 'Chạy thử'])
  })

  it('TC-008 | hết hạn: sửa có phí, gửi báo giá, chờ khách xác nhận', () => {
    const f = new Flow(db).precheck('HET_HAN').assignDiagnosis().diagnose()
    C.decideEligibility(db, user(db, 'cskh'), f.c.id, f.v, {
      decision: 'CO_PHI',
      ruleCode: 'D3',
      reason: 'Hết hạn bảo hành',
      quote: { items: [{ label: 'IC nguồn', qty: 1, unitPrice: 450_000 }], labor: 200_000 },
    })
    expect(f.case.status).toBe('QUOTED')
    expect(f.case.quotes.at(-1)).toMatchObject({ total: 650_000, status: 'DA_GUI' })
  })

  it('TC-012 | lưu phiên bản chính sách và mã quy tắc của quyết định; bắt buộc ghi lý do (BR-05)', () => {
    const f = new Flow(db).toEligibility()
    fails(() => C.decideEligibility(db, user(db, 'cskh'), f.c.id, f.v, { decision: 'MIEN_PHI', ruleCode: 'D1', reason: '  ' }), 422, /lý do/)
    f.free('D9')
    expect(f.case.eligibility).toMatchObject({ ruleCode: 'D9', policyCode: 'BH-TC-2026', by: 'u-cskh' })
  })

  it('TC-014 | khách từ chối báo giá: chuyển chuẩn bị trả không sửa (EX-10)', () => {
    const f = new Flow(db).precheck('HET_HAN').assignDiagnosis().diagnose()
    C.decideEligibility(db, user(db, 'cskh'), f.c.id, f.v, { decision: 'CO_PHI', ruleCode: 'D3', reason: 'Hết hạn', quote: { items: [], labor: 300_000 } })
    fails(() => C.recordQuoteResponse(db, user(db, 'cskh'), f.c.id, f.v, { accepted: false, method: '', note: '' }), 422, /phương thức/)
    C.recordQuoteResponse(db, user(db, 'cskh'), f.c.id, f.v, { accepted: false, method: 'Gọi điện', note: 'Khách không sửa' })
    expect(f.case.status).toBe('RETURN_PENDING')
    expect(f.case.workOrderId).toBeUndefined()
  })

  it('BR-07 | báo giá vượt 2.000.000 đ phải chờ quản lý duyệt rồi CSKH mới gửi khách', () => {
    const f = new Flow(db).precheck('HET_HAN').assignDiagnosis().diagnose()
    C.decideEligibility(db, user(db, 'cskh'), f.c.id, f.v, {
      decision: 'CO_PHI',
      ruleCode: 'D3',
      reason: 'Hết hạn',
      quote: { items: [{ label: 'Mainboard', qty: 1, unitPrice: PARAMS.quoteApprovalThreshold }], labor: 1 },
    })
    expect(f.case.status).toBe('WAITING_APPROVAL')
    const ap = db.approvals.find((a) => a.id === f.case.pendingApprovalId)!
    fails(() => C.decideApproval(db, user(db, 'cskh'), ap.id, { approve: true, note: '' }), 403)
    C.decideApproval(db, user(db, 'quanly'), ap.id, { approve: true, note: 'Đồng ý' })
    expect(f.case.status).toBe('ELIGIBILITY_REVIEW')
    C.sendApprovedQuote(db, user(db, 'cskh'), f.c.id, f.v)
    expect(f.case.status).toBe('QUOTED')
  })

  it('BR-07 | không lách ngưỡng duyệt bằng số âm, số lượng lẻ hay tổng 0', () => {
    const f = new Flow(db).precheck('HET_HAN').assignDiagnosis().diagnose()
    const bad = [
      { items: [{ label: 'A', qty: 1, unitPrice: -5 }], labor: 0 },
      { items: [{ label: 'A', qty: 0.5, unitPrice: 5_000_000 }], labor: 0 },
      { items: [], labor: 0 },
    ]
    for (const quote of bad)
      fails(() => C.decideEligibility(db, user(db, 'cskh'), f.c.id, f.v, { decision: 'CO_PHI', ruleCode: 'D3', reason: 'x', quote }), 422)
  })

  it('C03 | không kết luận bảo hành trước khi có biên bản chẩn đoán', () => {
    const f = new Flow(db).precheck()
    fails(() => C.decideEligibility(db, user(db, 'cskh'), f.c.id, f.v, { decision: 'MIEN_PHI', ruleCode: 'D1', reason: 'x' }), 422)
  })

  it('TC-011 | dấu hiệu rơi vỡ/vào nước: gợi ý D4 sửa có phí; máy không sửa được chỉ cho kết luận "không sửa" (D10)', () => {
    expect(suggestRule('CON_HAN', 'NUOC_ROI_VO', true)).toBe('D4')
    const f = new Flow(db).toEligibility({ repairable: false, tasks: [] })
    fails(() => C.decideEligibility(db, user(db, 'cskh'), f.c.id, f.v, { decision: 'MIEN_PHI', ruleCode: 'D1', reason: 'x' }), 422, /D10/)
    C.decideEligibility(db, user(db, 'cskh'), f.c.id, f.v, { decision: 'KHONG_SUA', ruleCode: 'D10', reason: 'Không có linh kiện thay thế' })
    expect(f.case.status).toBe('RETURN_PENDING')
  })

  it('TC-009 TC-010 | serial không xác thực / thiếu chứng từ: gợi ý D6 và yêu cầu khách bổ sung (WAITING_INFORMATION)', () => {
    expect(suggestRule('CHUA_DU_THONG_TIN', undefined, true)).toBe('D6')
    const f = new Flow(db).precheck('CHUA_DU_THONG_TIN')
    C.requestInfo(db, user(db, 'cskh'), f.c.id, f.v, 'Gửi ảnh hóa đơn')
    expect(f.case.status).toBe('WAITING_INFORMATION')
    C.infoSupplied(db, user(db, 'cskh'), f.c.id, f.v, 'Đã nhận hóa đơn')
    expect(f.case.status).toBe('PRECHECK')
  })
})

describe('Lệnh sửa chữa, kho, phân công (FR-03, FR-04)', () => {
  it('TC-015 | không có lệnh sửa chữa khi chưa có quyết định đủ điều kiện', () => {
    const f = new Flow(db).toEligibility()
    expect(f.case.workOrderId).toBeUndefined()
    fails(() => C.assignRepair(db, user(db, 'dieuphoi'), f.c.id, f.v, 'u-ktv1'), 422)
  })

  it('TC-016 TC-017 | phương án được duyệt thì tự lập WO với nhiều công việc', () => {
    const f = new Flow(db).toEligibility().free()
    expect(f.wo.code).toMatch(/^WO-\d{4}$/)
    expect(f.wo.tasks).toHaveLength(2)
    expect(f.case.sla.planConfirmedAt).toBeTruthy()
  })

  it('TC-018 | không hoàn tất sửa khi còn công việc chưa xong (BR-19)', () => {
    const f = new Flow(db).toEligibility().free().assignRepair().start()
    fails(() => f.finish(), 422, /chưa hoàn thành/)
    f.doTasks().finish()
    expect(f.case.status).toBe('TESTING')
  })

  it('TC-019 TC-020 TC-022 | thiếu linh kiện → chờ linh kiện + đề nghị mua; đủ hàng → giữ, cấp phát, ghi biến động kho', () => {
    const p3 = db.parts.find((p) => p.id === 'p3')! // còn khả dụng 1
    const f = new Flow(db).toEligibility({ parts: [{ partId: 'p3', qty: 2 }] }).free()
    expect(f.case.status).toBe('WO_CREATED')
    f.reserve() // giữ được 1
    expect(p3.reserved).toBe(2)
    C.markShortage(db, user(db, 'kho'), f.wo.id, 'Thiếu 1 pin')
    expect(f.case.status).toBe('WAITING_PARTS')
    const purchase = db.approvals.find((a) => a.type === 'MUA_LINH_KIEN' && a.woId === f.wo.id)!
    expect(purchase.qty).toBe(1)
    expect(f.case.sla.pauses.at(-1)).toMatchObject({ reason: 'CHO_LINH_KIEN' })
    C.decideApproval(db, user(db, 'quanly'), purchase.id, { approve: true, note: 'Mua' })
    C.stockIn(db, user(db, 'kho'), 'p3', 1, 'Hàng về')
    expect(db.approvals.find((a) => a.id === purchase.id)!.received).toBe(1)
    f.reserve()
    expect(f.case.status).toBe('READY_TO_REPAIR')
    expect(f.case.sla.pauses.at(-1)!.end).toBeTruthy()
    f.assignRepair().issue()
    expect(f.wo.parts[0]).toMatchObject({ qty: 2, issued: 2, reserved: 0 })
    expect(db.stockMoves[0]).toMatchObject({ type: 'XUAT', partId: 'p3', qty: 2, woCode: f.wo.code })
  })

  it('TC-021 TC-050 | không giữ vượt tồn khả dụng; tồn không bao giờ âm (BR-14)', () => {
    const p3 = db.parts.find((p) => p.id === 'p3')!
    const a = new Flow(db).toEligibility({ parts: [{ partId: 'p3', qty: 1 }] }).free()
    const b = new Flow(db, intakeInput({ customer: { name: 'B', phone: '0911000002' } })).toEligibility({ parts: [{ partId: 'p3', qty: 1 }] }).free()
    a.reserve()
    fails(() => b.reserve(), 422, /khả dụng|Báo thiếu/)
    expect(p3.onHand - p3.reserved).toBe(0)
    expect(p3.reserved).toBeLessThanOrEqual(p3.onHand)
  })

  it('TC-023 | linh kiện cấp mà không dùng hết thì chờ trả kho và nhập lại tồn (BR-16)', () => {
    const p2 = db.parts.find((p) => p.id === 'p2')!
    const f = new Flow(db)
      .toEligibility({ parts: [{ partId: 'p2', qty: 2 }] })
      .free()
      .reserve()
      .assignRepair()
      .issue()
    const onHand = p2.onHand
    f.start().doTasks().finish('ktv.an', { p2: 1 })
    expect(f.wo.parts[0]).toMatchObject({ used: 1, returnPending: 1 })
    C.confirmPartReturn(db, user(db, 'kho'), f.wo.id, 'p2')
    expect(p2.onHand).toBe(onHand + 1)
    expect(db.stockMoves[0]).toMatchObject({ type: 'TRA', qty: 1 })
  })

  it('TC-024 TC-025 | phân công KTV; đổi người phải ghi lý do và giữ lịch sử phân công (BR-11, EX-07)', () => {
    const f = new Flow(db).toEligibility().free().assignRepair('u-ktv1')
    expect(f.case.status).toBe('ASSIGNED')
    fails(() => f.assignRepair('u-ktv2'), 422, /lý do/)
    f.assignRepair('u-ktv2', 'KTV An nghỉ ốm')
    expect(f.wo.technicianId).toBe('u-ktv2')
    expect(f.wo.assignHistory.map((h) => [h.from, h.to, h.reason])).toEqual([
      [undefined, 'u-ktv1', undefined],
      ['u-ktv1', 'u-ktv2', 'KTV An nghỉ ốm'],
    ])
    fails(() => f.start('ktv.an'), 403)
  })

  it('TC-026 | không giao việc cho tài khoản đã khóa hoặc không phải KTV', () => {
    const f = new Flow(db).precheck()
    db.users.find((u) => u.id === 'u-ktv3')!.active = false
    fails(() => C.assignDiagnosis(db, user(db, 'dieuphoi'), f.c.id, f.v, 'u-ktv3'), 422)
    fails(() => C.assignDiagnosis(db, user(db, 'dieuphoi'), f.c.id, f.v, 'u-qc'), 422)
  })

  it('TC-049 | thao tác với version cũ bị từ chối 409, không ghi đè thay đổi của người khác (EX-14)', () => {
    const f = new Flow(db)
    const stale = f.v
    f.precheck()
    fails(() => C.requestCancel(db, user(db, 'tiepnhan'), f.c.id, stale, 'Khách đổi ý'), 409)
  })

  it('BR-12 | đổi phương án khi đang sửa: KTV đề xuất, CSKH chấp nhận miễn phí, công việc mới được thêm', () => {
    const f = new Flow(db).toEligibility().free().assignRepair().start()
    C.proposePlanChange(db, user(db, 'ktv.an'), f.c.id, f.v, {
      finding: 'Hỏng thêm quạt',
      newPlan: 'Thay IC + quạt',
      addTasks: [{ title: 'Thay quạt', minutes: 20 }],
      addParts: [],
      extraLabor: 0,
    })
    fails(() => C.toggleTask(db, user(db, 'ktv.an'), f.wo.id, f.wo.tasks[0].id), 422, /đổi phương án/)
    C.reviewPlanChange(db, user(db, 'cskh'), f.c.id, f.v, { result: 'MIEN_PHI', note: 'Trong phạm vi bảo hành' })
    expect(f.wo.tasks.map((t) => t.title)).toContain('Thay quạt')
    f.doTasks().finish()
    expect(f.case.status).toBe('TESTING')
  })
})

describe('Kiểm tra chất lượng và bàn giao (FR-05)', () => {
  it('TC-029 | QC đạt khi đủ các mục bắt buộc theo loại thiết bị', () => {
    const f = new Flow(db).toTesting().qc(true)
    expect(f.case.status).toBe('READY_FOR_DELIVERY')
    expect(f.case.qc[0]).toMatchObject({ round: 1, pass: true, by: 'u-qc' })
  })

  it('TC-029 | checklist rỗng/thiếu mục bắt buộc/trùng mục thì từ chối (QA-DEF-004, BR-20)', () => {
    const f = new Flow(db).toTesting()
    fails(() => C.submitQc(db, user(db, 'qc'), f.c.id, f.v, [], ''), 422)
    fails(
      () => C.submitQc(db, user(db, 'qc'), f.c.id, f.v, [{ label: 'Lên nguồn, khởi động vào hệ điều hành', mandatory: false, pass: true, note: '' }], ''),
      422,
      /bắt buộc/
    )
  })

  it('TC-030 TC-032 | QC không đạt → sửa lại; QC lần hai đạt → chờ bàn giao (EX-08)', () => {
    const f = new Flow(db).toTesting()
    fails(() => f.qc(false, ''), 422, /mô tả lỗi/)
    f.qc(false, 'Vẫn sập nguồn khi chạy nặng')
    expect(f.case.status).toBe('REWORK')
    expect(f.case.reworkCount).toBe(1)
    f.start()
    expect(f.wo.tasks.at(-1)!.title).toMatch(/Xử lý lại/)
    f.doTasks().finish().qc(true)
    expect(f.case.status).toBe('READY_FOR_DELIVERY')
    expect(f.case.qc.map((q) => q.pass)).toEqual([false, true])
  })

  it('PARAM-10 | sau 2 lần sửa lại vẫn không đạt thì chuyển quản lý xem xét', () => {
    const f = new Flow(db).toTesting()
    for (let i = 0; i < PARAMS.maxRework; i++)
      f.qc(false, `Lỗi lần ${i + 1}`)
        .start()
        .doTasks()
        .finish()
    f.qc(false, 'Lỗi lần 3')
    expect(f.case.status).toBe('MANAGER_REVIEW')
    const ap = db.approvals.find((a) => a.id === f.case.pendingApprovalId)!
    expect(ap.type).toBe('XEM_XET_QC')
    C.decideApproval(db, user(db, 'quanly'), ap.id, { approve: true, note: 'Dừng sửa', option: 'TRA_MAY' })
    expect(f.case.status).toBe('RETURN_PENDING')
  })

  it('1.5 | người kiểm tra chất lượng phải khác người sửa', () => {
    const f = new Flow(db).toTesting()
    f.wo.technicianId = 'u-qc'
    fails(() => f.qc(true), 403)
  })

  it('TC-031 TC-033 | không bàn giao khi QC chưa đạt hoặc thiếu xác nhận người nhận (BR-23, BR-24)', () => {
    const f = new Flow(db).toTesting()
    fails(() => f.handover(), 422)
    f.qc(true)
    fails(() => f.handover({ signed: false }), 422, /xác nhận/)
    fails(() => f.handover({ recipientName: '  ' }), 422, /người nhận/)
    expect(f.case.status).toBe('READY_FOR_DELIVERY')
  })

  it('TC-034 | bàn giao có xác nhận thì hoàn tất phiếu', () => {
    const f = new Flow(db).toTesting().qc(true).handover({ rating: 5 })
    expect(f.case.status).toBe('COMPLETED')
    expect(f.case.handover).toMatchObject({ relation: 'CHINH_CHU', signed: true, withoutRepair: false, by: 'u-tn' })
  })

  it('BR-23 | trả máy không sửa: bàn giao không cần QC', () => {
    const f = new Flow(db).toEligibility({ repairable: false, tasks: [] })
    C.decideEligibility(db, user(db, 'cskh'), f.c.id, f.v, { decision: 'KHONG_SUA', ruleCode: 'D10', reason: 'Hết linh kiện' })
    C.confirmReturn(db, user(db, 'cskh'), f.c.id, f.v, { text: 'Trả máy nguyên trạng', feeAgreed: true })
    f.handover({ inspectionFee: PARAMS.inspectionFee })
    expect(f.case.status).toBe('COMPLETED')
    expect(f.case.handover!.withoutRepair).toBe(true)
  })

  it('TC-056 | phiếu đã hoàn tất không thao tác tiếp được (không mở lại)', () => {
    const f = new Flow(db).toTesting().qc(true).handover()
    fails(() => f.precheck(), 422)
    fails(() => C.requestCancel(db, user(db, 'tiepnhan'), f.c.id, f.v, 'x'), 422)
    expect(TRANSITIONS.some((t) => t.from === 'COMPLETED')).toBe(false)
  })
})

describe('Nhật ký và hủy phiếu (FR-07)', () => {
  it('TC-043 | mỗi lần chuyển trạng thái ghi lịch sử phiếu (from/to/by/at) và nhật ký thao tác', () => {
    const f = new Flow(db).toTesting().qc(true).handover()
    const moves = f.case.events.filter((e) => e.to)
    expect(moves.map((e) => e.to)).toEqual([
      'RECEIVED',
      'PRECHECK',
      'DIAGNOSING',
      'ELIGIBILITY_REVIEW',
      'READY_TO_REPAIR',
      'ASSIGNED',
      'IN_REPAIR',
      'TESTING',
      'READY_FOR_DELIVERY',
      'COMPLETED',
    ])
    for (const e of moves.slice(1)) expect(e).toMatchObject({ from: expect.any(String), by: expect.stringMatching(/^u-/), at: expect.any(String) })
    expect(db.audit.filter((a) => a.ref === f.case.code).length).toBeGreaterThanOrEqual(moves.length)
  })

  it('TC-044 | hủy phiếu bắt buộc qua quản lý duyệt và lưu lý do', () => {
    const f = new Flow(db)
    C.requestCancel(db, user(db, 'tiepnhan'), f.c.id, f.v, 'Khách lấy lại máy')
    expect(f.case.status).toBe('RECEIVED')
    fails(() => C.requestCancel(db, user(db, 'cskh'), f.c.id, f.v, 'lần 2'), 422, /chờ quản lý/)
    const ap = db.approvals.find((a) => a.id === f.case.pendingApprovalId)!
    fails(() => C.decideApproval(db, user(db, 'quanly'), ap.id, { approve: false, note: ' ' }), 422, /lý do/)
    C.decideApproval(db, user(db, 'quanly'), ap.id, { approve: true, note: 'Đồng ý' })
    expect(f.case).toMatchObject({ status: 'CANCELLED', cancelReason: 'Khách lấy lại máy' })
    fails(() => C.decideApproval(db, user(db, 'quanly'), ap.id, { approve: true, note: '' }), 409)
  })

  it('TC-055 | khiếu nại gắn với phiếu, chỉ CSKH chuyển lên quản lý, giải quyết phải ghi kết quả', () => {
    const f = new Flow(db)
    C.createComplaint(db, user(db, 'cskh'), f.c.id, 'Thiết bị tái phát lỗi')
    const q = db.complaints[0]
    fails(() => C.updateComplaint(db, user(db, 'quanly'), q.id, 'CHUYEN_QUAN_LY', ''), 403)
    C.updateComplaint(db, user(db, 'cskh'), q.id, 'CHUYEN_QUAN_LY', 'Cần quản lý quyết')
    fails(() => C.updateComplaint(db, user(db, 'quanly'), q.id, 'DA_GIAI_QUYET', ''), 422)
    C.updateComplaint(db, user(db, 'quanly'), q.id, 'DA_GIAI_QUYET', 'Bảo hành lại miễn phí')
    expect(db.complaints[0]).toMatchObject({ status: 'DA_GIAI_QUYET', resolution: 'Bảo hành lại miễn phí' })
    fails(() => C.createComplaint(db, user(db, 'cskh'), 'khong-co', 'x'), 404)
  })
})

describe('Cổng khách hàng: yêu cầu trực tuyến và phản hồi báo giá (TV7)', () => {
  const req = (serial = 'ONL-001') => ({
    customer: { name: 'Khách Online', phone: '0977000001' },
    device: { kind: 'printer' as const, brand: 'Canon', model: 'LBP2900', serial },
    symptom: 'Kẹt giấy',
  })

  it('yêu cầu trực tuyến tạo phiếu PENDING_ACCEPT, chống gửi trùng; tiếp nhận lập biên nhận khi khách mang máy tới', () => {
    const c = C.createOnlineRequest(db, req(), 'web-1')
    expect(C.createOnlineRequest(db, req(), 'web-1').id).toBe(c.id)
    expect(c).toMatchObject({ status: 'PENDING_ACCEPT', channel: 'ONLINE' })
    C.acceptOnline(db, user(db, 'tiepnhan'), c.id, c.version, { condition: 'Nguyên vẹn', accessories: [], noAccessories: true, photos: [{ name: 'a.jpg' }] })
    expect(db.cases.find((x) => x.id === c.id)!.status).toBe('RECEIVED')
  })

  it('yêu cầu trực tuyến không gộp serial của khách khác và không lộ chủ sở hữu (QA-DEF-003)', () => {
    const e = fails(() => C.createOnlineRequest(db, { ...req('C02XK1ABJG5H') }, 'web-2'), 422)
    expect(e.message).not.toMatch(/\d{3}\)/)
  })

  it('khách đồng ý báo giá trên cổng → lập lệnh sửa chữa, phương thức ghi "Cổng khách hàng (OTP)"', () => {
    const f = new Flow(db).precheck('HET_HAN').assignDiagnosis().diagnose()
    C.decideEligibility(db, user(db, 'cskh'), f.c.id, f.v, { decision: 'CO_PHI', ruleCode: 'D3', reason: 'Hết hạn', quote: { items: [], labor: 300_000 } })
    C.customerRespondQuote(db, f.c.id, true)
    expect(f.case.status).toBe('READY_TO_REPAIR')
    expect(f.case.quotes.at(-1)).toMatchObject({ status: 'KHACH_DONG_Y', confirmMethod: 'Cổng khách hàng (OTP)' })
    fails(() => C.customerRespondQuote(db, f.c.id, true), 422)
  })
})
