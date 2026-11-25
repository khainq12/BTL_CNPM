import type { Db } from './db'
import type { User, WarrantyCase, WorkOrder } from './types'

// Quyền xem dữ liệu theo vai trò (ma trận phân quyền 5.3, AT-14). Dùng ở cả giao diện (ẩn/hiện) và backend (lọc dữ liệu trả về).

// Ai được mở chi tiết phiếu: từ chối kể cả khi biết mã phiếu.
export function canViewCase(me: User, c: WarrantyCase, wo?: WorkOrder) {
  switch (me.role) {
    case 'KTV':
      return c.diagnosisTechId === me.id || wo?.technicianId === me.id || !!wo?.assignHistory.some((h) => h.to === me.id)
    case 'KHO':
      return !!wo
    case 'QC':
      return !!wo && (c.status === 'TESTING' || c.qc.some((q) => q.by === me.id))
    default:
      return true
  }
}

// Thông tin liên hệ khách: KTV, kho, QC không được xem (hàng 1 ma trận 5.3).
export function canSeeCustomer(me: User) {
  return ['TN', 'CSKH', 'DP', 'QL'].includes(me.role)
}

export const maskPhone = (p: string) => (p.length > 3 ? `${'•'.repeat(p.length - 3)}${p.slice(-3)}` : '•••')

// Dữ liệu một tài khoản được nhận (backend trả về ở GET /workspace). Nguyên tắc dữ liệu tối thiểu (NFR-01, TC-046, TC-054):
// - không bao giờ trả mật khẩu/băm mật khẩu, khóa chống gửi trùng;
// - KTV, kho, QC chỉ nhận phiếu mình được xem, không nhận số điện thoại/email khách;
// - nhật ký thao tác chỉ quản lý được xem.
export function workspaceView(db: Db, me: User): Db {
  const woOf = new Map(db.workOrders.map((w) => [w.caseId, w]))
  const cases = db.cases.filter((c) => canViewCase(me, c, woOf.get(c.id)))
  const caseIds = new Set(cases.map((c) => c.id))
  const contact = canSeeCustomer(me)
  const visibleCustomers = contact ? null : new Set(cases.map((c) => c.customerId))
  return {
    users: db.users.map((u) => ({ ...u, password: '' })),
    customers: db.customers
      .filter((c) => !visibleCustomers || visibleCustomers.has(c.id))
      .map((c) => (contact ? c : { id: c.id, name: c.name, phone: maskPhone(c.phone) })),
    devices: contact ? db.devices : db.devices.filter((d) => cases.some((c) => c.deviceId === d.id)),
    parts: db.parts,
    cases,
    workOrders: db.workOrders.filter((w) => caseIds.has(w.caseId)),
    approvals: me.role === 'QL' || me.role === 'KHO' || me.role === 'CSKH' ? db.approvals : db.approvals.filter((a) => !a.caseId || caseIds.has(a.caseId)),
    complaints: ['CSKH', 'QL'].includes(me.role) ? db.complaints : [],
    stockMoves: ['KHO', 'QL', 'DP', 'KTV'].includes(me.role) ? db.stockMoves : [],
    audit: me.role === 'QL' ? db.audit : [],
    holidays: db.holidays,
    idempotency: {},
    counters: db.counters,
  }
}
