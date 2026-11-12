import type {
  Approval,
  AuditEntry,
  Complaint,
  Customer,
  Device,
  Part,
  StockMove,
  User,
  WarrantyCase,
  WorkOrder,
} from '@/domain/types'
import * as seed from './seed'

// "Backend giả" lưu trong localStorage để dữ liệu còn sau khi tải lại trang và dùng chung giữa các tab
// (mở 2 tab với 2 tài khoản để thử xung đột phiên bản EX-14). Thay bằng API thật của TV4.

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
  idempotency: Record<string, string>
  counters: { case: number; wo: number; complaint: number }
}

const KEY = 'woms-db-v1'

function fresh(): Db {
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
    idempotency: {},
    counters: { case: 200, wo: 40, complaint: 4 },
  })
  for (const c of db.cases) {
    if (c.events.length === 0) {
      c.events.push({ at: c.createdAt, by: c.receivedBy ?? 'khach', action: c.channel === 'ONLINE' ? 'Khách gửi yêu cầu trực tuyến' : 'Tạo phiếu tiếp nhận', to: c.channel === 'ONLINE' ? 'PENDING_ACCEPT' : 'RECEIVED' })
      if (c.precheck) c.events.push({ at: c.precheck.at, by: c.precheck.by, action: 'Ghi kết quả kiểm tra sơ bộ', from: 'RECEIVED', to: 'PRECHECK' })
      if (c.diagnosis) c.events.push({ at: c.diagnosis.at, by: c.diagnosis.by, action: 'Nộp biên bản chẩn đoán', from: 'DIAGNOSING', to: 'ELIGIBILITY_REVIEW' })
      if (c.eligibility) c.events.push({ at: c.eligibility.at, by: c.eligibility.by, action: `Kết luận bảo hành: ${c.eligibility.ruleCode}`, note: c.eligibility.reason })
    }
  }
  return db
}

let cache: Db | null = null

export function loadDb(): Db {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(KEY)
    cache = raw ? (JSON.parse(raw) as Db) : fresh()
  } catch {
    cache = fresh()
  }
  return cache
}

export function saveDb(db: Db) {
  cache = db
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    // bộ nhớ trình duyệt bị chặn: vẫn chạy được trong phiên hiện tại
  }
}

export function resetDb() {
  cache = fresh()
  saveDb(cache)
}

// Tab khác ghi dữ liệu thì bỏ cache để đọc lại.
export function onExternalChange(cb: () => void) {
  const handler = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null
      cb()
    }
  }
  window.addEventListener('storage', handler)
  return () => window.removeEventListener('storage', handler)
}
