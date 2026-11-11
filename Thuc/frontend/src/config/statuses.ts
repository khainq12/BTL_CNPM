// GIẢ ĐỊNH: lấy theo tài liệu khảo sát v0.2, mục 5. Chờ TV5 chốt danh sách chính thức.
// Đổi tên, thêm/bớt trạng thái hoặc quyền chuyển chỉ cần sửa file này.
import type { Role } from './roles'

export type CaseStatus =
  | 'NEW'
  | 'RECEIVED'
  | 'VERIFYING'
  | 'AWAITING_CUSTOMER'
  | 'IN_SERVICE'
  | 'READY_FOR_HANDOVER'
  | 'CLOSED'

export type Tone = 'neutral' | 'info' | 'wait' | 'done'

export const CASE_STATUS: Record<CaseStatus, { label: string; tone: Tone }> = {
  NEW: { label: 'Mới', tone: 'neutral' },
  RECEIVED: { label: 'Đã tiếp nhận', tone: 'info' },
  VERIFYING: { label: 'Đang xác minh', tone: 'info' },
  AWAITING_CUSTOMER: { label: 'Chờ khách', tone: 'wait' },
  IN_SERVICE: { label: 'Đang xử lý', tone: 'info' },
  READY_FOR_HANDOVER: { label: 'Sẵn sàng bàn giao', tone: 'done' },
  CLOSED: { label: 'Đã đóng', tone: 'neutral' },
}

export interface Transition {
  from: CaseStatus
  to: CaseStatus
  action: string
  roles: Role[]
  needsReason?: boolean
  // Điều kiện nghiệp vụ hiển thị cho người dùng khi thao tác bị chặn.
  guard?: string
}

export const CASE_TRANSITIONS: Transition[] = [
  { from: 'NEW', to: 'RECEIVED', action: 'Xác nhận tiếp nhận', roles: ['TN'] },
  { from: 'RECEIVED', to: 'VERIFYING', action: 'Bắt đầu xác minh', roles: ['CS'] },
  {
    from: 'VERIFYING',
    to: 'IN_SERVICE',
    action: 'Chuyển xử lý',
    roles: ['CS'],
    guard: 'Cần có quyết định quyền lợi kèm reason_code và bằng chứng (FR-02)',
  },
  { from: 'VERIFYING', to: 'AWAITING_CUSTOMER', action: 'Yêu cầu khách bổ sung', roles: ['CS'], needsReason: true },
  { from: 'AWAITING_CUSTOMER', to: 'VERIFYING', action: 'Đã nhận bổ sung', roles: ['CS'] },
  {
    from: 'IN_SERVICE',
    to: 'READY_FOR_HANDOVER',
    action: 'Sẵn sàng bàn giao',
    roles: ['TN'],
    guard: 'Work Order hoàn thành và lần QC mới nhất đạt (FR-05)',
  },
  { from: 'READY_FOR_HANDOVER', to: 'CLOSED', action: 'Bàn giao và đóng phiếu', roles: ['TN'] },
]
