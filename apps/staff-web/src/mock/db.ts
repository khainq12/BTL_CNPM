import type {
  Approval,
  AuditEntry,
  Complaint,
  Customer,
  Device,
  Holiday,
  Part,
  StockMove,
  User,
  WarrantyCase,
  WorkOrder,
} from '@/domain/types'
import { setHolidays } from '@/domain/sla'
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
  holidays: Holiday[]
  idempotency: Record<string, string>
  counters: { case: number; wo: number; complaint: number }
}

const KEY = 'woms-db-v3' // đổi khi cấu trúc dữ liệu giả thay đổi, để trình duyệt nạp lại dữ liệu mẫu

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
    holidays: seed.holidays,
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

// Xóa dữ liệu của các phiên bản cũ (có thể chứa ảnh) để không chiếm dung lượng trình duyệt.
function dropOldVersions() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('woms-db-') && k !== KEY) localStorage.removeItem(k)
  } catch {
    // bộ nhớ trình duyệt bị chặn: bỏ qua
  }
}

export function loadDb(): Db {
  if (cache) return cache
  dropOldVersions()
  try {
    const raw = localStorage.getItem(KEY)
    cache = raw ? (JSON.parse(raw) as Db) : fresh()
  } catch {
    cache = fresh()
  }
  setHolidays(cache.holidays.map((h) => h.date))
  return cache
}

export class StorageFullError extends Error {}

export function saveDb(db: Db) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch (e) {
    // Hết dung lượng (thường do ảnh): không nhận thay đổi để dữ liệu hiển thị khớp với dữ liệu đã lưu.
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) throw new StorageFullError()
    // Bộ nhớ bị chặn (chế độ riêng tư): vẫn chạy trong phiên hiện tại.
  }
  cache = db
  setHolidays(db.holidays.map((h) => h.date))
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
