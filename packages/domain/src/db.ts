import type { Approval, AuditEntry, Complaint, Customer, Device, Holiday, Part, StockMove, User, WarrantyCase, WorkOrder } from './types'
import * as seed from './seed'

// Toàn bộ trạng thái nghiệp vụ mà các lệnh (commands.ts) đọc và ghi.
// Bản chạy thử giữ trong localStorage; backend nạp từ PostgreSQL trong một transaction rồi ghi lại phần thay đổi.
export type Db = {
  users: User[]
  customers: Customer[]
  devices: Device[]
  parts: Part[]
  cases: WarrantyCase[]
  workOrders: WorkOrder[]
  approvals: Approval[]
  complaints: Complaint[]
  stockMoves: StockMove[]
  audit: AuditEntry[]
  holidays: Holiday[]
  idempotency: Record<string, string>
  counters: { case: number; wo: number; complaint: number }
}

export const emptyDb = (): Db => ({
  users: [],
  customers: [],
  devices: [],
  parts: [],
  cases: [],
  workOrders: [],
  approvals: [],
  complaints: [],
  stockMoves: [],
  audit: [],
  holidays: [],
  idempotency: {},
  counters: { case: 0, wo: 0, complaint: 0 },
})

// Dữ liệu mẫu dùng chung: frontend chạy thử và lệnh seed của backend nạp cùng một bộ.
export function createSeedDb(): Db {
  const db: Db = structuredClone({
    users: seed.users,
    customers: seed.customers,
    devices: seed.devices,
    parts: seed.parts,
    cases: seed.cases,
    workOrders: seed.workOrders,
    approvals: seed.approvals,
    complaints: seed.complaints,
    stockMoves: seed.stockMoves,
    audit: seed.audit,
    holidays: seed.holidays,
    idempotency: {},
    counters: { case: 200, wo: 40, complaint: 4 },
  })
  for (const c of db.cases) {
    if (c.events.length === 0) {
      c.events.push({
        at: c.createdAt,
        by: c.receivedBy ?? 'khach',
        action: c.channel === 'ONLINE' ? 'Khách gửi yêu cầu trực tuyến' : 'Tạo phiếu tiếp nhận',
        to: c.channel === 'ONLINE' ? 'PENDING_ACCEPT' : 'RECEIVED',
      })
      if (c.precheck) c.events.push({ at: c.precheck.at, by: c.precheck.by, action: 'Ghi kết quả kiểm tra sơ bộ', from: 'RECEIVED', to: 'PRECHECK' })
      if (c.diagnosis) c.events.push({ at: c.diagnosis.at, by: c.diagnosis.by, action: 'Nộp biên bản chẩn đoán', from: 'DIAGNOSING', to: 'ELIGIBILITY_REVIEW' })
      if (c.eligibility)
        c.events.push({ at: c.eligibility.at, by: c.eligibility.by, action: `Kết luận bảo hành: ${c.eligibility.ruleCode}`, note: c.eligibility.reason })
    }
  }
  return db
}
