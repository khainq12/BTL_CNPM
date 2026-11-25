import type { Db } from './db'
import { slaInfo } from './sla'
import type { CaseStatus, WarrantyCase } from './types'

// Dữ liệu Customer Portal (TV7). Khách chỉ thấy 5 bước, không thấy trạng thái nội bộ, ghi chú nội bộ, SLA nội bộ
// hay thông tin người khác (NFR-01, TC-047, TC-048, TC-054).

export const PUBLIC_STEPS = ['Đã tiếp nhận', 'Đã xác minh bảo hành', 'Đang sửa chữa', 'Chờ kiểm tra chất lượng', 'Bàn giao'] as const

// Ánh xạ 21 trạng thái (bảng 6.2) sang 5 bước công khai. Dựa trên bảng của TV7, mở rộng cho các trạng thái của tài liệu hợp nhất.
export const PUBLIC_STEP_OF: Record<CaseStatus, number> = {
  DRAFT: 0,
  PENDING_ACCEPT: 0,
  RECEIVED: 0,
  PRECHECK: 0,
  WAITING_INFORMATION: 0,
  DIAGNOSING: 1,
  ELIGIBILITY_REVIEW: 1,
  WAITING_APPROVAL: 1,
  QUOTED: 1,
  WO_CREATED: 1,
  WAITING_PARTS: 1,
  READY_TO_REPAIR: 1,
  ASSIGNED: 1,
  IN_REPAIR: 2,
  REWORK: 2,
  MANAGER_REVIEW: 2,
  TESTING: 3,
  RETURN_PENDING: 4,
  READY_FOR_DELIVERY: 4,
  COMPLETED: 4,
  CANCELLED: 4,
}

// Lời nhắn cho khách theo trạng thái. Không chứa thông tin nội bộ.
export const PUBLIC_NOTE: Partial<Record<CaseStatus, string>> = {
  PENDING_ACCEPT: 'Yêu cầu đã được ghi nhận. Vui lòng mang thiết bị tới trung tâm để lập biên nhận.',
  WAITING_INFORMATION: 'Trung tâm cần bạn bổ sung thông tin. Nhân viên sẽ liên hệ theo số điện thoại đã đăng ký.',
  DIAGNOSING: 'Kỹ thuật viên đang kiểm tra nguyên nhân lỗi.',
  ELIGIBILITY_REVIEW: 'Trung tâm đang xét điều kiện bảo hành.',
  WAITING_APPROVAL: 'Trung tâm đang xét điều kiện bảo hành.',
  QUOTED: 'Cần bạn xác nhận báo giá để tiếp tục sửa chữa.',
  WAITING_PARTS: 'Thiết bị đang chờ linh kiện thay thế.',
  REWORK: 'Thiết bị đang được xử lý thêm sau kiểm tra chất lượng.',
  RETURN_PENDING: 'Thiết bị sẽ được trả lại không sửa. Nhân viên sẽ liên hệ hẹn ngày nhận.',
  READY_FOR_DELIVERY: 'Thiết bị đã sẵn sàng, mời bạn tới nhận. Mang theo biên nhận hoặc giấy tờ tùy thân.',
  COMPLETED: 'Thiết bị đã được bàn giao. Cảm ơn bạn đã sử dụng dịch vụ.',
  CANCELLED: 'Phiếu đã hủy.',
}

export const FINAL_PUBLIC: CaseStatus[] = ['COMPLETED', 'CANCELLED']

export type PublicTimelineItem = { step: number; label: string; at: string }

export type PublicCase = {
  code: string
  device: string
  symptom: string
  createdAt: string
  receivedAt?: string
  step: number
  stepLabel: string
  final: boolean
  note: string
  timeline: PublicTimelineItem[]
  eta: { message: string; dueAt?: string }
  quote?: { version: number; total: number; items: { label: string; qty: number; unitPrice: number }[]; labor: number; sentAt?: string }
}

const norm = (s: string) => String(s ?? '').replace(/\D/g, '')

// Cần cả mã phiếu và số điện thoại. Sai mã hay sai số đều cho cùng kết quả để không lộ phiếu có tồn tại không (BR-11).
export function findPublicCase(db: Pick<Db, 'cases' | 'customers'>, code: string, phone: string) {
  const c = db.cases.find(
    (x) =>
      x.code ===
      String(code ?? '')
        .trim()
        .toUpperCase()
  )
  if (!c) return undefined
  const owner = db.customers.find((x) => x.id === c.customerId)
  return owner && norm(owner.phone) === norm(phone) && norm(phone).length >= 9 ? c : undefined
}

export function publicTimeline(c: WarrantyCase): PublicTimelineItem[] {
  const out: PublicTimelineItem[] = []
  for (const e of c.events) {
    if (!e.to) continue
    const step = PUBLIC_STEP_OF[e.to]
    if (out.at(-1)?.step === step) continue
    out.push({ step, label: PUBLIC_STEPS[step], at: e.at })
  }
  return out
}

export function publicEta(c: WarrantyCase, now = Date.now()): PublicCase['eta'] {
  if (FINAL_PUBLIC.includes(c.status) || c.status === 'READY_FOR_DELIVERY') return { message: '' }
  const s = slaInfo(c, now)
  switch (s.kind) {
    case 'not_started':
      return { message: 'Ngày dự kiến hoàn thành sẽ có sau khi trung tâm xác nhận phương án sửa.' }
    case 'paused':
      return { message: 'Thời gian xử lý đang tạm dừng (chờ linh kiện hoặc chờ bạn xác nhận). Ngày dự kiến sẽ cập nhật khi xử lý tiếp tục.' }
    case 'overdue':
      return { message: 'Thời gian xử lý đang vượt dự kiến. Trung tâm sẽ liên hệ khi có cập nhật.' }
    case 'ok':
    case 'soon':
      return { message: 'Dự kiến hoàn thành sửa chữa trước:', dueAt: s.dueAt }
    default:
      return { message: '' }
  }
}

export function toPublicCase(db: Pick<Db, 'devices'>, c: WarrantyCase, now = Date.now()): PublicCase {
  const d = db.devices.find((x) => x.id === c.deviceId)
  const step = PUBLIC_STEP_OF[c.status]
  const q = c.quotes.at(-1)
  const quoteOpen = c.status === 'QUOTED' && q?.status === 'DA_GUI'
  return {
    code: c.code,
    device: d ? `${d.brand} ${d.model}` : '',
    symptom: c.symptom,
    createdAt: c.createdAt,
    receivedAt: c.receivedAt,
    step,
    stepLabel: PUBLIC_STEPS[step],
    final: FINAL_PUBLIC.includes(c.status),
    note: PUBLIC_NOTE[c.status] ?? '',
    timeline: publicTimeline(c),
    eta: publicEta(c, now),
    quote: quoteOpen && q ? { version: q.version, total: q.total, items: q.items, labor: q.labor, sentAt: q.sentAt } : undefined,
  }
}

// Các phiếu khác của cùng chủ thiết bị (chỉ hiện sau khi đã xác thực bằng mã phiếu + số điện thoại).
export function publicHistory(db: Pick<Db, 'cases' | 'devices'>, customerId: string) {
  return db.cases
    .filter((c) => c.customerId === customerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((c) => {
      const d = db.devices.find((x) => x.id === c.deviceId)
      return {
        code: c.code,
        device: d ? `${d.brand} ${d.model}` : '',
        createdAt: c.createdAt,
        stepLabel: PUBLIC_STEPS[PUBLIC_STEP_OF[c.status]],
        final: FINAL_PUBLIC.includes(c.status),
      }
    })
}
