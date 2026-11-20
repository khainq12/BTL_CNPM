import { format } from 'date-fns'
import { PARAMS } from '@/domain/params'
import { availableQty, missingQty, purchaseOpenQty, toOrderQty } from '@/domain/parts'
import { currentPlan, openChange } from '@/domain/plan-change'
import { openPause } from '@/domain/sla'
import { CASE_STATUS } from '@/domain/statuses'
import type {
  Approval,
  ApprovalType,
  AuditEntry,
  CaseStatus,
  Diagnosis,
  EligibilityDecision,
  Handover,
  Photo,
  PlanChange,
  QcItem,
  Quote,
  Role,
  User,
  WarrantyCase,
  WarrantyCheck,
  WorkOrder,
} from '@/domain/types'
import { type Db, loadDb, saveDb } from '@/mock/db'
import { DEMO_PASSWORD } from '@/mock/seed'

// Lớp gọi "API". Mỗi hàm tương ứng một endpoint REST dự kiến của TV4 (ghi ở comment).
// Quy tắc nghiệp vụ được kiểm tra lại ở đây, không chỉ dựa vào việc ẩn nút trên giao diện (BR-27, AT-14).

export class ApiError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 422,
    message: string
  ) {
    super(message)
  }
}

const now = () => new Date().toISOString()
const wait = (ms = 350) => new Promise((r) => setTimeout(r, ms + Math.random() * 250))
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`

function need(user: User, roles: Role[]) {
  if (!roles.includes(user.role)) throw new ApiError(403, 'Tài khoản của bạn không có quyền thực hiện thao tác này.')
}

function audit(db: Db, by: string, entity: AuditEntry['entity'], ref: string, action: string, detail?: string) {
  db.audit.unshift({ id: uid('log'), at: now(), by, entity, ref, action, detail })
}

function findCase(db: Db, id: string) {
  const c = db.cases.find((x) => x.id === id)
  if (!c) throw new ApiError(404, 'Không tìm thấy phiếu. Phiếu có thể đã bị hủy.')
  return c
}

function findWo(db: Db, id?: string) {
  const w = db.workOrders.find((x) => x.id === id)
  if (!w) throw new ApiError(404, 'Không tìm thấy lệnh sửa chữa.')
  return w
}

// Mọi thay đổi trên phiếu đi qua đây: kiểm tra phiên bản (EX-14), tăng version, ghi lịch sử và audit (BR-28).
async function onCase(
  user: User,
  caseId: string,
  version: number,
  action: string,
  fn: (c: WarrantyCase, db: Db) => { to?: CaseStatus; note?: string } | void
) {
  await wait()
  const db = structuredClone(loadDb())
  const c = findCase(db, caseId)
  if (c.version !== version)
    throw new ApiError(409, `Phiếu ${c.code} vừa được người khác cập nhật. Tải lại để xem thay đổi mới nhất trước khi thao tác tiếp.`)
  const from = c.status
  const r = fn(c, db) || {}
  if (r.to) c.status = r.to
  c.version += 1
  c.events.push({ at: now(), by: user.id, action, from: r.to ? from : undefined, to: r.to, note: r.note })
  audit(db, user.id, 'PHIEU', c.code, action, r.to ? `${CASE_STATUS[from].label} → ${CASE_STATUS[r.to].label}${r.note ? ` · ${r.note}` : ''}` : r.note)
  saveDb(db)
  return c
}

function expectStatus(c: WarrantyCase, ...s: CaseStatus[]) {
  if (!s.includes(c.status))
    throw new ApiError(422, `Phiếu đang ở trạng thái "${CASE_STATUS[c.status].label}", không thực hiện được thao tác này.`)
}

function newApproval(db: Db, user: User, type: ApprovalType, a: Partial<Approval> & { title: string; detail: string }) {
  const ap: Approval = { id: uid('ap'), type, requestedBy: user.id, requestedAt: now(), status: 'CHO_DUYET', ...a }
  db.approvals.unshift(ap)
  return ap
}

function endPause(c: WarrantyCase, reason: 'CHO_LINH_KIEN' | 'CHO_XAC_NHAN_GIA') {
  const p = openPause(c, reason)
  if (p) p.end = now()
}

// ---------- Phiên đăng nhập (POST /auth/login) ----------

export async function login(username: string, password: string) {
  await wait(500)
  const db = loadDb()
  const u = db.users.find((x) => x.username.toLowerCase() === username.trim().toLowerCase())
  if (!u || u.password !== password) throw new ApiError(401, 'Tên đăng nhập hoặc mật khẩu không đúng.')
  if (!u.active) throw new ApiError(403, 'Tài khoản đã bị khóa. Liên hệ quản lý để mở lại.')
  const d = structuredClone(db)
  audit(d, u.id, 'PHIEN', u.username, 'Đăng nhập')
  saveDb(d)
  return u
}

export function logAudit(user: User, action: string) {
  const d = structuredClone(loadDb())
  audit(d, user.id, 'PHIEN', user.username, action)
  saveDb(d)
}

export async function changePassword(user: User, current: string, next: string) {
  await wait()
  const db = structuredClone(loadDb())
  const u = db.users.find((x) => x.id === user.id)!
  if (u.password !== current) throw new ApiError(422, 'Mật khẩu hiện tại không đúng.')
  u.password = next
  audit(db, user.id, 'TAI_KHOAN', u.username, 'Đổi mật khẩu')
  saveDb(db)
}

// ---------- Tiếp nhận (POST /cases) ----------

export type IntakeInput = {
  customerId?: string
  customer: { name: string; phone: string; email?: string }
  deviceId?: string
  device: { kind: 'laptop' | 'pc' | 'printer'; brand: string; model: string; serial: string; purchaseDate?: string }
  symptom: string
  condition: string
  accessories: string[]
  noAccessories: boolean
  photos: Photo[]
}

export async function createCase(user: User, input: IntakeInput, idempotencyKey: string) {
  need(user, ['TN'])
  await wait(700)
  const db = structuredClone(loadDb())
  const done = db.idempotency[idempotencyKey]
  if (done) return db.cases.find((c) => c.id === done)! // EX-13: gửi lại cùng khóa không tạo phiếu thứ hai
  if (!input.photos.length) throw new ApiError(422, 'Cần ít nhất 1 ảnh hiện trạng.')

  let customer = db.customers.find((x) => x.id === input.customerId || x.phone === input.customer.phone)
  if (!customer) {
    customer = { id: uid('c'), ...input.customer }
    db.customers.push(customer)
  } else {
    Object.assign(customer, { name: input.customer.name, email: input.customer.email || customer.email })
  }
  const serial = input.device.serial.trim().toUpperCase()
  let device = db.devices.find((x) => x.id === input.deviceId || x.serial.toUpperCase() === serial)
  if (!device) {
    device = { id: uid('d'), customerId: customer.id, ...input.device, serial, warrantyMonths: PARAMS.defaultWarrantyMonths, policyCode: 'BH-TC-2026' }
    db.devices.push(device)
  }
  db.counters.case += 1
  const t = now()
  const c: WarrantyCase = {
    id: uid('k'),
    code: `CAS-${format(new Date(), 'yyyyMMdd')}-${String(db.counters.case).padStart(4, '0')}`,
    version: 1,
    status: 'RECEIVED',
    customerId: customer.id,
    deviceId: device.id,
    channel: 'QUAY',
    symptom: input.symptom,
    condition: input.condition,
    accessories: input.accessories,
    noAccessories: input.noAccessories,
    photos: input.photos,
    createdAt: t,
    receivedAt: t,
    receivedBy: user.id,
    quotes: [],
    reworkCount: 0,
    qc: [],
    sla: { pauses: [] },
    events: [{ at: t, by: user.id, action: 'Tạo phiếu tiếp nhận', to: 'RECEIVED' }],
  }
  db.cases.unshift(c)
  db.idempotency[idempotencyKey] = c.id
  audit(db, user.id, 'PHIEU', c.code, 'Tạo phiếu tiếp nhận (CaseCreated)')
  saveDb(db)
  return c
}

export function acceptOnline(user: User, id: string, v: number, d: { condition: string; accessories: string[]; noAccessories: boolean; photos: Photo[] }) {
  need(user, ['TN'])
  return onCase(user, id, v, 'Nhận máy, lập biên nhận', (c) => {
    expectStatus(c, 'PENDING_ACCEPT')
    Object.assign(c, d, { receivedAt: now(), receivedBy: user.id })
    return { to: 'RECEIVED' }
  })
}

export function requestCancel(user: User, id: string, v: number, reason: string) {
  need(user, ['TN', 'CSKH'])
  return onCase(user, id, v, 'Đề nghị hủy phiếu', (c, db) => {
    expectStatus(c, 'RECEIVED')
    if (c.pendingApprovalId) throw new ApiError(422, 'Phiếu đang có đề nghị chờ quản lý duyệt.')
    const ap = newApproval(db, user, 'HUY_HO_SO', { caseId: c.id, title: `Hủy phiếu ${c.code}`, detail: reason })
    c.pendingApprovalId = ap.id
    return { note: reason }
  })
}

// ---------- Kiểm tra sơ bộ (CSKH) ----------

export function savePrecheck(user: User, id: string, v: number, d: { warranty: WarrantyCheck; note: string }) {
  need(user, ['CSKH'])
  return onCase(user, id, v, 'Ghi kết quả kiểm tra sơ bộ', (c) => {
    expectStatus(c, 'RECEIVED', 'PRECHECK')
    c.precheck = { ...d, by: user.id, at: now() }
    return { to: c.status === 'RECEIVED' ? 'PRECHECK' : undefined, note: d.note }
  })
}

export function requestInfo(user: User, id: string, v: number, reason: string) {
  need(user, ['CSKH'])
  return onCase(user, id, v, 'Yêu cầu khách bổ sung thông tin', (c) => {
    expectStatus(c, 'PRECHECK')
    c.infoRequest = reason
    return { to: 'WAITING_INFORMATION', note: reason }
  })
}

export function infoSupplied(user: User, id: string, v: number, note: string) {
  need(user, ['CSKH'])
  return onCase(user, id, v, 'Khách đã bổ sung thông tin', (c) => {
    expectStatus(c, 'WAITING_INFORMATION')
    c.infoRequest = undefined
    return { to: 'PRECHECK', note }
  })
}

// ---------- Điều phối (DP) ----------

export function assignDiagnosis(user: User, id: string, v: number, techId: string, reason?: string) {
  need(user, ['DP'])
  return onCase(user, id, v, reason ? 'Đổi kỹ thuật viên chẩn đoán' : 'Phân công chẩn đoán', (c, db) => {
    expectStatus(c, 'PRECHECK', 'DIAGNOSING')
    if (!c.precheck) throw new ApiError(422, 'CSKH chưa ghi kết quả kiểm tra sơ bộ.')
    if (c.status === 'DIAGNOSING' && !reason?.trim()) throw new ApiError(422, 'Đổi người phụ trách phải ghi lý do (BR-11).')
    const tech = db.users.find((u) => u.id === techId && u.role === 'KTV' && u.active)
    if (!tech) throw new ApiError(422, 'Kỹ thuật viên không hợp lệ.')
    const old = c.diagnosisTechId
    c.diagnosisTechId = techId
    return { to: c.status === 'PRECHECK' ? 'DIAGNOSING' : undefined, note: reason ? `${nameOf(db, old)} → ${tech.name}: ${reason}` : `Giao ${tech.name}` }
  })
}

export function nameOf(db: Db, id?: string) {
  return db.users.find((u) => u.id === id)?.name ?? '—'
}

export async function assignRepair(user: User, caseId: string, v: number, techId: string, reason?: string) {
  need(user, ['DP'])
  return onCase(user, caseId, v, reason ? 'Đổi kỹ thuật viên sửa chữa' : 'Phân công sửa chữa', (c, db) => {
    expectStatus(c, 'READY_TO_REPAIR', 'ASSIGNED', 'IN_REPAIR', 'REWORK')
    const w = findWo(db, c.workOrderId)
    const tech = db.users.find((u) => u.id === techId && u.role === 'KTV' && u.active)
    if (!tech) throw new ApiError(422, 'Kỹ thuật viên không hợp lệ.')
    if (w.technicianId && !reason?.trim()) throw new ApiError(422, 'Đổi người phụ trách phải ghi lý do (BR-11).')
    w.assignHistory.push({ from: w.technicianId, to: techId, reason, by: user.id, at: now() })
    const old = w.technicianId
    w.technicianId = techId
    return { to: c.status === 'READY_TO_REPAIR' ? 'ASSIGNED' : undefined, note: old ? `${nameOf(db, old)} → ${tech.name}: ${reason}` : `Giao ${tech.name} (${w.code})` }
  })
}

// ---------- Kỹ thuật viên ----------

export function submitDiagnosis(user: User, id: string, v: number, d: Omit<Diagnosis, 'by' | 'at'>) {
  need(user, ['KTV'])
  return onCase(user, id, v, 'Nộp biên bản chẩn đoán', (c) => {
    expectStatus(c, 'DIAGNOSING')
    if (c.diagnosisTechId !== user.id) throw new ApiError(403, 'Phiếu này được giao cho kỹ thuật viên khác.')
    if (!d.cause.trim()) throw new ApiError(422, 'Nhập nguyên nhân lỗi trước khi lưu.')
    if (d.repairable && d.tasks.length === 0) throw new ApiError(422, 'Phương án sửa cần ít nhất 1 công việc.')
    c.diagnosis = { ...d, by: user.id, at: now() }
    return { to: 'ELIGIBILITY_REVIEW', note: d.cause }
  })
}

function createWorkOrder(db: Db, user: User, c: WarrantyCase) {
  const d = c.diagnosis!
  db.counters.wo += 1
  const w: WorkOrder = {
    id: uid('w'),
    code: `WO-${String(db.counters.wo).padStart(4, '0')}`,
    caseId: c.id,
    tasks: d.tasks.map((t, i) => ({ id: `${c.id}-t${i}-${Date.now()}`, title: t.title, minutes: t.minutes, done: false })),
    parts: d.parts.map((p) => ({ partId: p.partId, qty: p.qty, reserved: 0, issued: 0, used: 0, returnPending: 0, returned: 0 })),
    assignHistory: [],
    logs: [],
    createdAt: now(),
  }
  db.workOrders.push(w)
  c.workOrderId = w.id
  c.sla.planConfirmedAt = now()
  audit(db, user.id, 'WO', w.code, `Lập lệnh sửa chữa cho ${c.code}`)
  // Không cần linh kiện thì sẵn sàng sửa ngay (bảng 6.2: WO_CREATED → READY_TO_REPAIR).
  return w.parts.length === 0 ? ('READY_TO_REPAIR' as const) : ('WO_CREATED' as const)
}

// ---------- Xét điều kiện bảo hành, báo giá (CSKH) ----------

export type QuoteInput = { items: Quote['items']; labor: number }

export function decideEligibility(
  user: User,
  id: string,
  v: number,
  d: { decision: EligibilityDecision; ruleCode: string; reason: string; quote?: QuoteInput }
) {
  need(user, ['CSKH'])
  return onCase(user, id, v, 'Kết luận điều kiện bảo hành', (c, db) => {
    expectStatus(c, 'ELIGIBILITY_REVIEW')
    if (!c.diagnosis) throw new ApiError(422, 'Chưa có biên bản chẩn đoán. Không kết luận bảo hành khi chưa rõ nguyên nhân lỗi (C03).')
    if (!d.reason.trim()) throw new ApiError(422, 'Ghi lý do kết luận (BR-05).')
    const exceptionApproved = c.eligibility?.exceptionApproved
    c.eligibility = { decision: d.decision, ruleCode: d.ruleCode, reason: d.reason, policyCode: 'BH-TC-2026', exceptionApproved, by: user.id, at: now() }
    const note = `${d.ruleCode}: ${d.reason}`
    switch (d.decision) {
      case 'MIEN_PHI':
        if (!c.diagnosis.repairable) throw new ApiError(422, 'Kỹ thuật viên kết luận không sửa được (D10).')
        return { to: createWorkOrder(db, user, c), note }
      case 'KHONG_SUA':
        return { to: 'RETURN_PENDING', note }
      case 'NGOAI_LE': {
        const ap = newApproval(db, user, 'NGOAI_LE_BH', { caseId: c.id, title: `Ngoại lệ bảo hành ${c.code}`, detail: d.reason })
        c.pendingApprovalId = ap.id
        return { to: 'WAITING_APPROVAL', note }
      }
      case 'CO_PHI': {
        if (!d.quote || d.quote.items.length + (d.quote.labor > 0 ? 1 : 0) === 0) throw new ApiError(422, 'Báo giá chưa có hạng mục.')
        const total = d.quote.items.reduce((s, i) => s + i.qty * i.unitPrice, 0) + d.quote.labor
        const over = total > PARAMS.quoteApprovalThreshold
        const q: Quote = { version: c.quotes.length + 1, ...d.quote, total, status: over ? 'CHO_DUYET' : 'DA_GUI', createdBy: user.id, createdAt: now(), sentAt: over ? undefined : now() }
        c.quotes.push(q)
        if (over) {
          const ap = newApproval(db, user, 'BAO_GIA', { caseId: c.id, title: `Báo giá ${total.toLocaleString('vi-VN')} đ vượt ngưỡng ${PARAMS.quoteApprovalThreshold.toLocaleString('vi-VN')} đ`, detail: `${c.code}. ${d.reason}` })
          c.pendingApprovalId = ap.id
          return { to: 'WAITING_APPROVAL', note: `${note}. Báo giá v${q.version} chờ quản lý duyệt (BR-07).` }
        }
        return { to: 'QUOTED', note: `${note}. Đã gửi báo giá v${q.version} cho khách.` }
      }
    }
  })
}

export function sendApprovedQuote(user: User, id: string, v: number) {
  need(user, ['CSKH'])
  return onCase(user, id, v, 'Gửi báo giá đã duyệt cho khách', (c) => {
    expectStatus(c, 'ELIGIBILITY_REVIEW')
    const q = c.quotes.at(-1)
    if (q?.status !== 'DA_DUYET') throw new ApiError(422, 'Chưa có báo giá đã được quản lý duyệt.')
    q.status = 'DA_GUI'
    q.sentAt = now()
    return { to: 'QUOTED' }
  })
}

export function recordQuoteResponse(user: User, id: string, v: number, d: { accepted: boolean; method: string; note: string }) {
  need(user, ['CSKH'])
  return onCase(user, id, v, d.accepted ? 'Khách đồng ý báo giá' : 'Khách từ chối báo giá', (c, db) => {
    expectStatus(c, 'QUOTED')
    const q = c.quotes.at(-1)!
    if (!d.method) throw new ApiError(422, 'Chọn phương thức khách xác nhận (C08).')
    q.status = d.accepted ? 'KHACH_DONG_Y' : 'KHACH_TU_CHOI'
    q.confirmMethod = d.method
    q.confirmNote = d.note
    q.respondedAt = now()
    if (!d.accepted) return { to: 'RETURN_PENDING', note: `${d.method}. ${d.note}` }
    return { to: createWorkOrder(db, user, c), note: `Báo giá v${q.version} · ${d.method}` }
  })
}

export function confirmReturn(user: User, id: string, v: number, d: { text: string; feeAgreed: boolean }) {
  need(user, ['CSKH'])
  return onCase(user, id, v, 'Kết luận trả thiết bị không sửa', (c) => {
    expectStatus(c, 'RETURN_PENDING')
    if (!d.text.trim()) throw new ApiError(422, 'Ghi kết luận không sửa (BR-23).')
    c.returnConclusion = { ...d, by: user.id, at: now() }
    c.readyAt = now()
    return { to: 'READY_FOR_DELIVERY', note: d.text }
  })
}

// ---------- Kho ----------

async function onWo(user: User, woId: string, action: string, fn: (w: WorkOrder, c: WarrantyCase, db: Db) => { to?: CaseStatus; note?: string } | void) {
  await wait()
  const db = structuredClone(loadDb())
  const w = findWo(db, woId)
  const c = findCase(db, w.caseId)
  const from = c.status
  const r = fn(w, c, db) || {}
  if (r.to && r.to !== from) {
    c.status = r.to
    c.version += 1
    c.events.push({ at: now(), by: user.id, action, from, to: r.to, note: r.note })
  } else if (r.note) {
    c.version += 1
    c.events.push({ at: now(), by: user.id, action, note: r.note })
  }
  audit(db, user.id, 'WO', w.code, action, r.note)
  saveDb(db)
}

function allReserved(w: WorkOrder) {
  return w.parts.every((p) => missingQty(p) === 0)
}

export function reserveParts(user: User, woId: string) {
  need(user, ['KHO'])
  return onWo(user, woId, 'Giữ linh kiện cho lệnh sửa chữa', (w, c, db) => {
    if (!['WO_CREATED', 'WAITING_PARTS', 'READY_TO_REPAIR', 'ASSIGNED', 'IN_REPAIR', 'REWORK'].includes(c.status)) throw new ApiError(422, 'Phiếu không ở bước chuẩn bị linh kiện.')
    const notes: string[] = []
    for (const line of w.parts) {
      const missing = missingQty(line)
      if (missing <= 0) continue
      const take = Math.min(missing, availableQty(db, line.partId)) // BR-14: không giữ vượt số lượng khả dụng
      if (take <= 0) continue
      const part = db.parts.find((x) => x.id === line.partId)!
      part.reserved += take
      line.reserved += take
      db.stockMoves.unshift({ id: uid('s'), at: now(), by: user.id, type: 'GIU', partId: line.partId, qty: take, woCode: w.code })
      notes.push(`${part.name} × ${take}`)
    }
    if (!notes.length) {
      const missing = w.parts.filter((l) => missingQty(l) > 0)
      throw new ApiError(
        422,
        !missing.length
          ? 'Lệnh sửa chữa đã giữ đủ linh kiện.'
          : missing.every((l) => toOrderQty(db, w, l) === 0)
            ? 'Chưa có hàng để giữ. Phần thiếu đã có đề nghị mua, chờ hàng về rồi giữ.'
            : 'Không còn linh kiện khả dụng để giữ. Dùng "Báo thiếu linh kiện".'
      )
    }
    if (allReserved(w) && (c.status === 'WO_CREATED' || c.status === 'WAITING_PARTS')) {
      endPause(c, 'CHO_LINH_KIEN')
      return { to: 'READY_TO_REPAIR', note: `Đã giữ: ${notes.join(', ')}` }
    }
    // Linh kiện bổ sung khi đổi phương án đã về đủ: thôi tạm dừng, phiếu vẫn đang sửa.
    if (allReserved(w) && c.status === 'IN_REPAIR') endPause(c, 'CHO_LINH_KIEN')
    return { note: `Đã giữ: ${notes.join(', ')}` }
  })
}

export function markShortage(user: User, woId: string, note: string) {
  need(user, ['KHO'])
  return onWo(user, woId, 'Báo thiếu linh kiện', (w, c, db) => {
    // Báo thiếu được khi: chuẩn bị linh kiện; đang chờ linh kiện mà cần mua thêm (đề nghị cũ bị từ chối, hoặc hàng về
    // đã giữ cho lệnh khác); đang sửa mà đổi phương án thêm linh kiện (BR-12, phiếu giữ nguyên "Đang sửa").
    if (!['WO_CREATED', 'WAITING_PARTS', 'IN_REPAIR'].includes(c.status))
      throw new ApiError(422, 'Chỉ báo thiếu khi lệnh sửa chữa đang chuẩn bị linh kiện, đang chờ linh kiện hoặc đang sửa.')
    // Chỉ đề nghị mua phần không có sẵn trong kho và chưa có đề nghị mua đang chờ. Tính hết trước khi tạo đề nghị.
    const short = w.parts.map((l) => ({ l, qty: toOrderQty(db, w, l) })).filter((x) => x.qty > 0)
    if (!short.length) {
      const missing = w.parts.filter((l) => missingQty(l) > 0)
      throw new ApiError(
        422,
        !missing.length
          ? 'Lệnh sửa chữa đã đủ linh kiện.'
          : missing.some((l) => availableQty(db, l.partId) > 0)
            ? 'Kho còn hàng cho phần thiếu. Dùng "Giữ linh kiện khả dụng".'
            : 'Đã gửi đề nghị mua đủ phần thiếu, đang chờ linh kiện về.'
      )
    }
    for (const { l, qty } of short) {
      const part = db.parts.find((x) => x.id === l.partId)!
      newApproval(db, user, 'MUA_LINH_KIEN', { partId: l.partId, qty, woId: w.id, title: `Đề nghị mua ${part.name}`, detail: `${w.code} thiếu ${qty} ${part.unit}. ${note}` })
    }
    // Đang chờ sẵn thì không mở thêm khoảng tạm dừng: báo thiếu lại không kéo dài giới hạn 3 ngày (PARAM-17).
    if (!openPause(c, 'CHO_LINH_KIEN')) c.sla.pauses.push({ reason: 'CHO_LINH_KIEN', start: now() })
    return { to: c.status === 'WO_CREATED' ? 'WAITING_PARTS' : undefined, note: note || 'Thiếu linh kiện bắt buộc, đã gửi đề nghị mua.' }
  })
}

export function issueParts(user: User, woId: string) {
  need(user, ['KHO'])
  return onWo(user, woId, 'Cấp phát linh kiện cho kỹ thuật viên', (w, _c, db) => {
    if (!w.technicianId) throw new ApiError(422, 'Lệnh sửa chữa chưa có kỹ thuật viên nhận linh kiện.')
    const notes: string[] = []
    for (const line of w.parts) {
      if (line.reserved <= 0) continue
      const part = db.parts.find((x) => x.id === line.partId)!
      part.reserved -= line.reserved
      part.onHand -= line.reserved
      db.stockMoves.unshift({ id: uid('s'), at: now(), by: user.id, type: 'XUAT', partId: line.partId, qty: line.reserved, woCode: w.code, note: w.technicianId ? `Giao ${nameOf(db, w.technicianId)}` : undefined })
      notes.push(`${part.name} × ${line.reserved}`)
      line.issued += line.reserved
      line.reserved = 0
    }
    if (!notes.length) throw new ApiError(422, 'Chưa có linh kiện đã giữ để cấp phát.')
    return { note: `Đã cấp phát (BR-15): ${notes.join(', ')}` }
  })
}

export function confirmPartReturn(user: User, woId: string, partId: string) {
  need(user, ['KHO'])
  return onWo(user, woId, 'Nhận lại linh kiện chưa dùng', (w, _c, db) => {
    const line = w.parts.find((p) => p.partId === partId)
    if (!line || line.returnPending <= 0) throw new ApiError(422, 'Không có linh kiện chờ trả.')
    const part = db.parts.find((x) => x.id === partId)!
    part.onHand += line.returnPending
    db.stockMoves.unshift({ id: uid('s'), at: now(), by: user.id, type: 'TRA', partId, qty: line.returnPending, woCode: w.code })
    const note = `${part.name} × ${line.returnPending} (BR-16)`
    line.returned += line.returnPending
    line.returnPending = 0
    return { note }
  })
}

export async function stockIn(user: User, partId: string, qty: number, note: string, forPurchase = true) {
  need(user, ['KHO'])
  await wait()
  if (!(qty > 0)) throw new ApiError(422, 'Số lượng nhập phải lớn hơn 0.')
  const db = structuredClone(loadDb())
  const part = db.parts.find((x) => x.id === partId)
  if (!part) throw new ApiError(404, 'Không tìm thấy linh kiện.')
  part.onHand += qty
  // Hàng về theo đề nghị mua đã duyệt: ghi nhận cho đề nghị cũ trước (BR-17), để biết lệnh nào còn chờ hàng.
  // Kho bỏ chọn khi hàng nhập không phải từ đề nghị mua (ví dụ nhà cung cấp đổi bảo hành).
  const credited: string[] = []
  if (forPurchase) {
    let left = qty
    const open = db.approvals
      .filter((a) => a.type === 'MUA_LINH_KIEN' && a.partId === partId && a.status === 'DA_DUYET' && purchaseOpenQty(a) > 0)
      .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt))
    for (const a of open) {
      if (left <= 0) break
      const take = Math.min(left, purchaseOpenQty(a))
      a.received = (a.received ?? 0) + take
      left -= take
      credited.push(`${a.title} × ${take}`)
    }
  }
  db.stockMoves.unshift({ id: uid('s'), at: now(), by: user.id, type: 'NHAP', partId, qty, note })
  audit(db, user.id, 'KHO', part.sku, `Nhập kho ${qty} ${part.unit}`, [note, credited.length ? `Theo đề nghị: ${credited.join('; ')}` : ''].filter(Boolean).join(' · '))
  saveDb(db)
}

export async function requestPurchase(user: User, partId: string, qty: number, reason: string) {
  need(user, ['KHO'])
  await wait()
  const db = structuredClone(loadDb())
  const part = db.parts.find((x) => x.id === partId)!
  newApproval(db, user, 'MUA_LINH_KIEN', { partId, qty, title: `Đề nghị mua ${qty} ${part.unit} ${part.name}`, detail: reason })
  audit(db, user.id, 'KHO', part.sku, 'Gửi đề nghị mua linh kiện', reason)
  saveDb(db)
}

export async function requestAdjust(user: User, partId: string, counted: number, reason: string) {
  need(user, ['KHO'])
  await wait()
  if (!reason.trim()) throw new ApiError(422, 'Ghi nguyên nhân chênh lệch (BR-18).')
  const db = structuredClone(loadDb())
  const part = db.parts.find((x) => x.id === partId)!
  newApproval(db, user, 'DIEU_CHINH_KHO', { partId, qty: counted, title: `Điều chỉnh tồn ${part.name}: ${part.onHand} → ${counted}`, detail: reason })
  audit(db, user.id, 'KHO', part.sku, 'Gửi đề nghị điều chỉnh tồn kho', reason)
  saveDb(db)
}

// ---------- Sửa chữa (KTV) ----------

export function startRepair(user: User, id: string, v: number) {
  need(user, ['KTV'])
  return onCase(user, id, v, 'Bắt đầu sửa chữa', (c, db) => {
    expectStatus(c, 'ASSIGNED', 'REWORK')
    const w = findWo(db, c.workOrderId)
    if (w.technicianId !== user.id) throw new ApiError(403, 'Lệnh sửa chữa được giao cho kỹ thuật viên khác.')
    const missing = w.parts.filter((p) => p.issued < p.qty)
    if (missing.length) throw new ApiError(422, 'Chưa nhận đủ linh kiện từ kho (BR-13).')
    if (c.status === 'REWORK') {
      const last = c.qc.at(-1)
      w.tasks.push({ id: `${w.id}-rw${c.reworkCount}`, title: `Xử lý lại: ${last?.defect ?? 'theo kết quả QC'}`, minutes: 30, done: false })
    }
    w.startedAt ??= now()
    return { to: 'IN_REPAIR' }
  })
}

export async function toggleTask(user: User, woId: string, taskId: string) {
  need(user, ['KTV'])
  await wait(150)
  const db = structuredClone(loadDb())
  const w = findWo(db, woId)
  if (w.technicianId !== user.id) throw new ApiError(403, 'Lệnh sửa chữa được giao cho kỹ thuật viên khác.')
  const c = findCase(db, w.caseId)
  if (c.status !== 'IN_REPAIR') throw new ApiError(422, 'Chỉ cập nhật công việc khi đang sửa.')
  if (openChange(c)) throw new ApiError(422, 'Đang chờ xác nhận đổi phương án. Tạm ngừng công việc cho tới khi có kết quả (BR-12).')
  const t = w.tasks.find((x) => x.id === taskId)!
  t.done = !t.done
  t.doneAt = t.done ? now() : undefined
  audit(db, user.id, 'WO', w.code, t.done ? `Hoàn thành: ${t.title}` : `Mở lại: ${t.title}`)
  saveDb(db)
}

export async function addWoLog(user: User, woId: string, text: string) {
  need(user, ['KTV'])
  await wait(200)
  const db = structuredClone(loadDb())
  const w = findWo(db, woId)
  w.logs.push({ at: now(), by: user.id, text })
  audit(db, user.id, 'WO', w.code, 'Ghi nhật ký sửa chữa', text)
  saveDb(db)
}

export function finishRepair(user: User, id: string, v: number, used: Record<string, number>, note: string) {
  need(user, ['KTV'])
  return onCase(user, id, v, 'Hoàn tất sửa chữa, chuyển kiểm tra chất lượng', (c, db) => {
    expectStatus(c, 'IN_REPAIR')
    const w = findWo(db, c.workOrderId)
    if (w.technicianId !== user.id) throw new ApiError(403, 'Lệnh sửa chữa được giao cho kỹ thuật viên khác.')
    if (openChange(c)) throw new ApiError(422, 'Đang chờ xác nhận đổi phương án (BR-12).')
    if (w.tasks.some((t) => !t.done)) throw new ApiError(422, 'Còn công việc chưa hoàn thành (BR-19).')
    if (w.parts.some((p) => p.issued < p.qty)) throw new ApiError(422, 'Chưa nhận đủ linh kiện của phương án hiện hành từ kho.')
    for (const p of w.parts) {
      const u = used[p.partId] ?? p.issued
      if (u < 0 || u > p.issued - p.used) throw new ApiError(422, 'Số linh kiện đã dùng không hợp lệ.')
      p.used += u
      p.returnPending += p.issued - p.used - p.returned - p.returnPending
    }
    w.finishedAt = now()
    if (note.trim()) w.logs.push({ at: now(), by: user.id, text: note })
    return { to: 'TESTING', note }
  })
}

// ---------- Đổi phương án khi đang sửa (BR-12) ----------
// Bảng 6.2 không có bước chuyển riêng cho việc này. Theo RACI: KTV đề xuất, CSKH xét lại điều kiện bảo hành
// và báo giá, quản lý duyệt nếu báo giá bổ sung vượt ngưỡng, khách xác nhận lại (tạm dừng hạn tối đa 5 ngày, PARAM-16).

function needOpenChange(c: WarrantyCase, ...s: PlanChange['status'][]) {
  const ch = openChange(c)
  if (!ch || !s.includes(ch.status)) throw new ApiError(422, 'Không có đề xuất đổi phương án ở bước này. Tải lại để xem trạng thái mới nhất.')
  return ch
}

function applyChange(db: Db, user: User, c: WarrantyCase, ch: PlanChange) {
  const w = findWo(db, c.workOrderId)
  ch.addTasks.forEach((t, i) => w.tasks.push({ id: `${w.id}-pc${ch.no}-${i}`, title: t.title, minutes: t.minutes, done: false }))
  for (const p of ch.addParts) {
    const line = w.parts.find((x) => x.partId === p.partId)
    if (line) line.qty += p.qty
    else w.parts.push({ partId: p.partId, qty: p.qty, reserved: 0, issued: 0, used: 0, returnPending: 0, returned: 0 })
  }
  ch.status = 'DA_AP_DUNG'
  ch.closedAt = now()
  audit(db, user.id, 'WO', w.code, `Áp dụng phương án mới (đề xuất #${ch.no})`, ch.newPlan)
}

// Dừng sửa giữa chừng: bỏ giữ linh kiện chưa cấp; linh kiện đã cấp mà chưa dùng chờ kho nhận lại (BR-16).
function releaseWoParts(db: Db, user: User, w: WorkOrder) {
  for (const line of w.parts) {
    if (line.reserved > 0) {
      const part = db.parts.find((x) => x.id === line.partId)!
      part.reserved -= line.reserved
      db.stockMoves.unshift({ id: uid('s'), at: now(), by: user.id, type: 'BO_GIU', partId: line.partId, qty: line.reserved, woCode: w.code, note: 'Dừng sửa' })
      line.reserved = 0
    }
    line.returnPending = line.issued - line.used - line.returned
    line.qty = line.issued // phần chưa cấp không còn cần nữa
  }
  w.parts = w.parts.filter((l) => l.qty > 0)
  // Đề nghị mua do báo thiếu cho lệnh này mà quản lý chưa duyệt thì không còn cần: hệ thống tự hủy.
  // Không ghi người dừng sửa là người hủy (họ không có quyền phê duyệt); nhật ký ghi vào lệnh sửa chữa.
  for (const ap of db.approvals) {
    if (ap.type !== 'MUA_LINH_KIEN' || ap.woId !== w.id || ap.status !== 'CHO_DUYET') continue
    ap.status = 'DA_HUY'
    ap.decidedAt = now()
    ap.decisionNote = `${w.code} dừng sửa (${nameOf(db, user.id)} ghi nhận), không còn cần mua.`
    audit(db, user.id, 'WO', w.code, 'Tự hủy đề nghị mua chưa duyệt vì dừng sửa', ap.title)
  }
}

export type PlanChangeInput = Pick<PlanChange, 'finding' | 'newPlan' | 'addTasks' | 'addParts' | 'extraLabor'>

export function proposePlanChange(user: User, id: string, v: number, d: PlanChangeInput) {
  need(user, ['KTV'])
  return onCase(user, id, v, 'Đề xuất đổi phương án sửa chữa', (c, db) => {
    expectStatus(c, 'IN_REPAIR')
    const w = findWo(db, c.workOrderId)
    if (w.technicianId !== user.id) throw new ApiError(403, 'Lệnh sửa chữa được giao cho kỹ thuật viên khác.')
    if (openChange(c)) throw new ApiError(422, 'Đã có đề xuất đổi phương án đang chờ xử lý.')
    if (!d.finding.trim() || !d.newPlan.trim()) throw new ApiError(422, 'Ghi lỗi mới phát hiện và phương án đề xuất.')
    if (d.addParts.some((p) => !(p.qty > 0) || !db.parts.some((x) => x.id === p.partId))) throw new ApiError(422, 'Linh kiện bổ sung không hợp lệ.')
    c.planChanges ??= []
    const ch: PlanChange = { id: uid('pc'), no: c.planChanges.length + 1, status: 'CHO_CSKH', ...d, oldPlan: currentPlan(c), proposedBy: user.id, proposedAt: now() }
    c.planChanges.push(ch)
    return { note: `#${ch.no}: ${d.finding}` }
  })
}

export function reviewPlanChange(
  user: User,
  id: string,
  v: number,
  d: { result: 'MIEN_PHI' | 'CO_PHI' | 'KHONG_DONG_Y'; note: string; quote?: QuoteInput }
) {
  need(user, ['CSKH'])
  const action = {
    MIEN_PHI: 'Chấp nhận đổi phương án, không phát sinh phí',
    CO_PHI: 'Lập báo giá bổ sung cho phương án mới',
    KHONG_DONG_Y: 'Không chấp nhận đổi phương án',
  }[d.result]
  return onCase(user, id, v, action, (c, db) => {
    expectStatus(c, 'IN_REPAIR')
    const ch = needOpenChange(c, 'CHO_CSKH')
    if (!d.note.trim()) throw new ApiError(422, 'Ghi căn cứ kết luận (BR-05).')
    Object.assign(ch, { reviewNote: d.note, reviewedBy: user.id, reviewedAt: now() })
    if (d.result === 'KHONG_DONG_Y') {
      Object.assign(ch, { status: 'TU_CHOI', outcome: 'CSKH không chấp nhận, tiếp tục phương án cũ', closedAt: now() })
      return { note: `#${ch.no}: ${d.note}` }
    }
    if (d.result === 'MIEN_PHI') {
      ch.charge = 'MIEN_PHI'
      applyChange(db, user, c, ch)
      ch.outcome = 'Áp dụng, trong phạm vi bảo hành'
      return { note: `#${ch.no}: ${d.note}` }
    }
    if (!d.quote || d.quote.items.length + (d.quote.labor > 0 ? 1 : 0) === 0) throw new ApiError(422, 'Báo giá bổ sung chưa có hạng mục.')
    const total = d.quote.items.reduce((s, i) => s + i.qty * i.unitPrice, 0) + d.quote.labor
    const over = total > PARAMS.quoteApprovalThreshold
    const q: Quote = {
      version: c.quotes.length + 1,
      planChangeNo: ch.no,
      ...d.quote,
      total,
      status: over ? 'CHO_DUYET' : 'DA_GUI',
      createdBy: user.id,
      createdAt: now(),
      sentAt: over ? undefined : now(),
    }
    c.quotes.push(q)
    Object.assign(ch, { charge: 'CO_PHI', quoteVersion: q.version })
    if (over) {
      const ap = newApproval(db, user, 'BAO_GIA', {
        caseId: c.id,
        planChangeId: ch.id,
        title: `Báo giá bổ sung ${total.toLocaleString('vi-VN')} đ vượt ngưỡng ${PARAMS.quoteApprovalThreshold.toLocaleString('vi-VN')} đ`,
        detail: `${c.code}, đổi phương án #${ch.no}. ${d.note}`,
      })
      c.pendingApprovalId = ap.id
      ch.status = 'CHO_DUYET'
      return { note: `Báo giá bổ sung v${q.version} chờ quản lý duyệt (BR-07).` }
    }
    ch.status = 'CHO_KHACH'
    c.sla.pauses.push({ reason: 'CHO_XAC_NHAN_GIA', start: now() })
    return { note: `Đã gửi báo giá bổ sung v${q.version} cho khách. Tạm dừng tính hạn tối đa ${PARAMS.pauseQuoteMaxDays} ngày làm việc (PARAM-16).` }
  })
}

export function sendPlanChangeQuote(user: User, id: string, v: number) {
  need(user, ['CSKH'])
  return onCase(user, id, v, 'Gửi báo giá bổ sung đã duyệt cho khách', (c) => {
    const ch = needOpenChange(c, 'CHO_GUI')
    const q = c.quotes.find((x) => x.version === ch.quoteVersion)
    if (q?.status !== 'DA_DUYET') throw new ApiError(422, 'Báo giá bổ sung chưa được quản lý duyệt.')
    q.status = 'DA_GUI'
    q.sentAt = now()
    ch.status = 'CHO_KHACH'
    c.sla.pauses.push({ reason: 'CHO_XAC_NHAN_GIA', start: now() })
    return { note: `Báo giá v${q.version}. Tạm dừng tính hạn (PARAM-16).` }
  })
}

export function respondPlanChange(
  user: User,
  id: string,
  v: number,
  d: { accepted: boolean; method: string; note: string; next?: 'TIEP_TUC' | 'TRA_MAY' }
) {
  need(user, ['CSKH'])
  return onCase(user, id, v, d.accepted ? 'Khách đồng ý báo giá bổ sung' : 'Khách từ chối báo giá bổ sung', (c, db) => {
    expectStatus(c, 'IN_REPAIR')
    const ch = needOpenChange(c, 'CHO_KHACH')
    if (!d.method) throw new ApiError(422, 'Chọn phương thức khách xác nhận (C08).')
    const q = c.quotes.find((x) => x.version === ch.quoteVersion)!
    Object.assign(q, { status: d.accepted ? 'KHACH_DONG_Y' : 'KHACH_TU_CHOI', confirmMethod: d.method, confirmNote: d.note, respondedAt: now() })
    endPause(c, 'CHO_XAC_NHAN_GIA')
    if (d.accepted) {
      applyChange(db, user, c, ch)
      ch.outcome = `Khách đồng ý báo giá v${q.version}`
      return { note: `${d.method}${d.note ? `. ${d.note}` : ''}` }
    }
    Object.assign(ch, { status: 'TU_CHOI', closedAt: now() })
    if (d.next === 'TRA_MAY') {
      ch.outcome = 'Khách từ chối, dừng sửa và trả thiết bị'
      releaseWoParts(db, user, findWo(db, c.workOrderId))
      endPause(c, 'CHO_LINH_KIEN')
      return { to: 'RETURN_PENDING', note: `${d.method}. Khách không đồng ý chi phí phát sinh, dừng sửa.` }
    }
    ch.outcome = 'Khách từ chối, tiếp tục phương án cũ'
    return { note: `${d.method}. Tiếp tục theo phương án cũ.` }
  })
}

// ---------- Kiểm tra chất lượng (QC) ----------

export function submitQc(user: User, id: string, v: number, items: QcItem[], defect: string, photos: Photo[] = []) {
  need(user, ['QC'])
  return onCase(user, id, v, 'Ghi kết quả kiểm tra chất lượng', (c, db) => {
    expectStatus(c, 'TESTING')
    const w = findWo(db, c.workOrderId)
    if (w.technicianId === user.id) throw new ApiError(403, 'Người kiểm tra phải khác người sửa.')
    const pass = items.every((i) => !i.mandatory || i.pass)
    if (!pass && !defect.trim()) throw new ApiError(422, 'Kết quả không đạt phải mô tả lỗi còn tồn tại.')
    c.qc.push({ round: c.qc.length + 1, items, pass, defect: pass ? undefined : defect, photos: photos.length ? photos : undefined, by: user.id, at: now() })
    if (pass) {
      c.readyAt = now()
      return { to: 'READY_FOR_DELIVERY', note: `Đạt lần ${c.qc.length}` }
    }
    if (c.reworkCount >= PARAMS.maxRework) {
      const ap = newApproval(db, user, 'XEM_XET_QC', { caseId: c.id, title: `${c.code} không đạt QC sau ${c.reworkCount} lần sửa lại`, detail: defect })
      c.pendingApprovalId = ap.id
      return { to: 'MANAGER_REVIEW', note: defect }
    }
    c.reworkCount += 1
    return { to: 'REWORK', note: `Sửa lại lần ${c.reworkCount}: ${defect}` }
  })
}

// ---------- Bàn giao (TN) ----------

export function handover(user: User, id: string, v: number, d: Omit<Handover, 'by' | 'at' | 'withoutRepair'>) {
  need(user, ['TN'])
  return onCase(user, id, v, 'Bàn giao thiết bị', (c) => {
    expectStatus(c, 'READY_FOR_DELIVERY')
    const withoutRepair = !!c.returnConclusion && !c.qc.some((q) => q.pass)
    if (!withoutRepair && !c.qc.at(-1)?.pass) throw new ApiError(422, 'Kết quả kiểm tra chất lượng mới nhất chưa đạt (BR-23).')
    if (!d.accessoriesOk || !d.conditionOk || !d.signed) throw new ApiError(422, 'Cần đối chiếu phụ kiện, tình trạng và có xác nhận của người nhận (BR-24).')
    c.handover = { ...d, withoutRepair, by: user.id, at: now() }
    return { to: 'COMPLETED', note: `Người nhận: ${d.recipientName} (${d.relation === 'CHINH_CHU' ? 'chính chủ' : 'nhận hộ'})` }
  })
}

// ---------- Phê duyệt (QL) ----------

export async function decideApproval(user: User, approvalId: string, d: { approve: boolean; note: string; option?: 'SUA_TIEP' | 'TRA_MAY' }) {
  need(user, ['QL'])
  await wait()
  const db = structuredClone(loadDb())
  const ap = db.approvals.find((a) => a.id === approvalId)
  if (!ap) throw new ApiError(404, 'Không tìm thấy đề nghị.')
  if (ap.status !== 'CHO_DUYET') throw new ApiError(409, 'Đề nghị này đã được xử lý.')
  if (!d.approve && !d.note.trim()) throw new ApiError(422, 'Ghi lý do khi từ chối.')
  ap.status = d.approve ? 'DA_DUYET' : 'TU_CHOI'
  ap.decidedBy = user.id
  ap.decidedAt = now()
  ap.decisionNote = d.note
  ap.decisionOption = d.option

  const c = ap.caseId ? findCase(db, ap.caseId) : undefined
  const move = (to: CaseStatus | undefined, action: string) => {
    if (!c) return
    const from = c.status
    if (to) c.status = to
    c.version += 1
    c.pendingApprovalId = undefined
    c.events.push({ at: now(), by: user.id, action, from: to ? from : undefined, to, note: d.note })
  }

  switch (ap.type) {
    case 'BAO_GIA': {
      const q = c!.quotes.at(-1)!
      q.status = d.approve ? 'DA_DUYET' : 'TU_CHOI_DUYET'
      const ch = ap.planChangeId ? c!.planChanges?.find((x) => x.id === ap.planChangeId) : undefined
      if (ch) {
        // Báo giá bổ sung khi đổi phương án: phiếu vẫn đang sửa, chỉ đề xuất chuyển bước.
        ch.status = d.approve ? 'CHO_GUI' : 'CHO_CSKH'
        move(undefined, d.approve ? `Quản lý duyệt báo giá bổ sung v${q.version}` : `Quản lý từ chối báo giá bổ sung v${q.version}`)
      } else move('ELIGIBILITY_REVIEW', d.approve ? 'Quản lý duyệt báo giá' : 'Quản lý từ chối báo giá')
      break
    }
    case 'NGOAI_LE_BH':
      c!.eligibility = c!.eligibility && { ...c!.eligibility, exceptionApproved: d.approve }
      move('ELIGIBILITY_REVIEW', d.approve ? 'Quản lý duyệt ngoại lệ bảo hành' : 'Quản lý từ chối ngoại lệ')
      break
    case 'HUY_HO_SO':
      move(d.approve ? 'CANCELLED' : undefined, d.approve ? 'Quản lý duyệt hủy phiếu' : 'Quản lý từ chối hủy phiếu')
      if (d.approve) c!.cancelReason = ap.detail
      break
    case 'XEM_XET_QC':
      if (!d.option) throw new ApiError(422, 'Chọn phương án tiếp theo.')
      move(d.option === 'SUA_TIEP' ? 'IN_REPAIR' : 'RETURN_PENDING', d.option === 'SUA_TIEP' ? 'Quản lý duyệt sửa tiếp' : 'Quản lý duyệt dừng sửa, trả thiết bị')
      if (d.option === 'TRA_MAY') releaseWoParts(db, user, findWo(db, c!.workOrderId))
      if (d.option === 'SUA_TIEP') {
        const w = findWo(db, c!.workOrderId)
        w.tasks.push({ id: `${w.id}-mr${Date.now()}`, title: `Xử lý theo chỉ đạo quản lý: ${d.note || 'xem lịch sử phiếu'}`, minutes: 60, done: false })
      }
      break
    case 'DIEU_CHINH_KHO':
      if (d.approve) {
        const p = db.parts.find((x) => x.id === ap.partId)!
        db.stockMoves.unshift({ id: uid('s'), at: now(), by: user.id, type: 'DIEU_CHINH', partId: p.id, qty: (ap.qty ?? p.onHand) - p.onHand, note: ap.detail })
        p.onHand = ap.qty ?? p.onHand
      }
      break
    case 'MUA_LINH_KIEN':
      // Không cần sửa lệnh: số đang chờ mua tính từ chính các đề nghị (domain/parts.ts). Bị từ chối thì phần đó
      // thành "chưa đề nghị" và kho báo thiếu lại được.
      break
  }
  audit(db, user.id, 'PHE_DUYET', ap.title, d.approve ? 'Duyệt' : 'Từ chối', d.note)
  saveDb(db)
}

// ---------- Khiếu nại ----------

export async function createComplaint(user: User, caseId: string, content: string) {
  need(user, ['CSKH'])
  await wait()
  if (!content.trim()) throw new ApiError(422, 'Nhập nội dung khiếu nại.')
  const db = structuredClone(loadDb())
  db.counters.complaint += 1
  const code = `KN-${String(db.counters.complaint).padStart(4, '0')}`
  db.complaints.unshift({ id: uid('q'), code, caseId, content, status: 'MOI', createdBy: user.id, createdAt: now(), updatedAt: now() })
  audit(db, user.id, 'KHIEU_NAI', code, 'Tiếp nhận khiếu nại', content)
  saveDb(db)
}

export async function updateComplaint(user: User, id: string, status: 'DANG_XU_LY' | 'CHUYEN_QUAN_LY' | 'DA_GIAI_QUYET', resolution: string) {
  need(user, ['CSKH', 'QL'])
  await wait()
  const db = structuredClone(loadDb())
  const q = db.complaints.find((x) => x.id === id)!
  if (status === 'DA_GIAI_QUYET' && !resolution.trim()) throw new ApiError(422, 'Ghi kết quả giải quyết.')
  if (status === 'CHUYEN_QUAN_LY' && user.role !== 'CSKH') throw new ApiError(403, 'Chỉ CSKH chuyển khiếu nại lên quản lý.')
  q.status = status
  if (status === 'DA_GIAI_QUYET') q.resolution = resolution.trim()
  q.log = [...(q.log ?? []), { at: now(), by: user.id, status, text: resolution.trim() }]
  q.updatedAt = now()
  audit(db, user.id, 'KHIEU_NAI', q.code, `Cập nhật: ${status}`, resolution)
  saveDb(db)
}

// ---------- Tài khoản (QL) ----------

export async function saveUser(user: User, u: Pick<User, 'name' | 'username' | 'role' | 'phone' | 'active'> & { id?: string }) {
  need(user, ['QL'])
  await wait()
  const db = structuredClone(loadDb())
  if (db.users.some((x) => x.username === u.username && x.id !== u.id)) throw new ApiError(422, 'Tên đăng nhập đã tồn tại.')
  if (u.id === user.id && !u.active) throw new ApiError(422, 'Không thể tự khóa tài khoản đang đăng nhập.')
  if (u.id) {
    Object.assign(db.users.find((x) => x.id === u.id)!, u)
    audit(db, user.id, 'TAI_KHOAN', u.username, 'Cập nhật tài khoản', `${u.role}${u.active ? '' : ', đã khóa'}`)
  } else {
    db.users.push({ ...u, id: uid('u'), password: DEMO_PASSWORD })
    audit(db, user.id, 'TAI_KHOAN', u.username, 'Tạo tài khoản', u.role)
  }
  saveDb(db)
}

export async function resetPassword(user: User, userId: string) {
  need(user, ['QL'])
  await wait()
  const db = structuredClone(loadDb())
  const u = db.users.find((x) => x.id === userId)!
  u.password = DEMO_PASSWORD
  audit(db, user.id, 'TAI_KHOAN', u.username, 'Đặt lại mật khẩu')
  saveDb(db)
}

// ---------- Lịch làm việc (QL) ----------

export async function addHoliday(user: User, date: string, name: string) {
  need(user, ['QL'])
  await wait()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError(422, 'Chọn ngày nghỉ.')
  if (!name.trim()) throw new ApiError(422, 'Ghi tên ngày nghỉ.')
  const db = structuredClone(loadDb())
  if (db.holidays.some((h) => h.date === date)) throw new ApiError(422, 'Ngày này đã có trong lịch nghỉ.')
  db.holidays.push({ date, name: name.trim() })
  db.holidays.sort((a, b) => a.date.localeCompare(b.date))
  audit(db, user.id, 'CAU_HINH', date, 'Thêm ngày nghỉ', name.trim())
  saveDb(db)
}

export async function removeHoliday(user: User, date: string) {
  need(user, ['QL'])
  await wait()
  const db = structuredClone(loadDb())
  const h = db.holidays.find((x) => x.date === date)
  if (!h) throw new ApiError(404, 'Ngày nghỉ không còn trong lịch.')
  db.holidays = db.holidays.filter((x) => x.date !== date)
  audit(db, user.id, 'CAU_HINH', date, 'Xóa ngày nghỉ', h.name)
  saveDb(db)
}
