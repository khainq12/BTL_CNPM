import type { CaseStatus, Role } from './types'

export type Tone = 'neutral' | 'info' | 'wait' | 'warn' | 'done' | 'bad'

// 21 trạng thái theo bảng 6.2 tài liệu hợp nhất. Tên tiếng Việt do TV6 đặt (xem SUY_LUAN.txt).
export const CASE_STATUS: Record<CaseStatus, { label: string; tone: Tone; owner: Role[] }> = {
  DRAFT: { label: 'Nháp (khách đang soạn)', tone: 'neutral', owner: [] },
  PENDING_ACCEPT: { label: 'Chờ nhận máy', tone: 'wait', owner: ['TN'] },
  RECEIVED: { label: 'Đã tiếp nhận', tone: 'info', owner: ['CSKH'] },
  PRECHECK: { label: 'Kiểm tra sơ bộ', tone: 'info', owner: ['CSKH', 'DP'] },
  WAITING_INFORMATION: { label: 'Chờ bổ sung thông tin', tone: 'wait', owner: ['CSKH'] },
  DIAGNOSING: { label: 'Đang chẩn đoán', tone: 'info', owner: ['KTV'] },
  ELIGIBILITY_REVIEW: { label: 'Xét điều kiện bảo hành', tone: 'info', owner: ['CSKH'] },
  WAITING_APPROVAL: { label: 'Chờ quản lý duyệt', tone: 'wait', owner: ['QL'] },
  QUOTED: { label: 'Chờ khách xác nhận giá', tone: 'wait', owner: ['CSKH'] },
  WO_CREATED: { label: 'Đã lập lệnh sửa chữa', tone: 'info', owner: ['KHO', 'DP'] },
  WAITING_PARTS: { label: 'Chờ linh kiện', tone: 'wait', owner: ['KHO'] },
  READY_TO_REPAIR: { label: 'Sẵn sàng sửa', tone: 'info', owner: ['DP'] },
  ASSIGNED: { label: 'Đã phân công', tone: 'info', owner: ['KTV'] },
  IN_REPAIR: { label: 'Đang sửa', tone: 'info', owner: ['KTV'] },
  TESTING: { label: 'Chờ kiểm tra chất lượng', tone: 'info', owner: ['QC'] },
  REWORK: { label: 'Sửa lại', tone: 'warn', owner: ['KTV'] },
  MANAGER_REVIEW: { label: 'Quản lý xem xét', tone: 'warn', owner: ['QL'] },
  RETURN_PENDING: { label: 'Chuẩn bị trả không sửa', tone: 'wait', owner: ['CSKH'] },
  READY_FOR_DELIVERY: { label: 'Chờ bàn giao', tone: 'done', owner: ['TN'] },
  COMPLETED: { label: 'Hoàn tất', tone: 'done', owner: [] },
  CANCELLED: { label: 'Đã hủy', tone: 'neutral', owner: [] },
}

// Bảng chuyển trạng thái 6.2. Cột "roles" do TV6 suy ra từ ma trận phân quyền 5.3 và quy trình 6.1.
export const TRANSITIONS: { from: CaseStatus; to: CaseStatus; roles: Role[] | 'HE_THONG'; when: string }[] = [
  { from: 'DRAFT', to: 'PENDING_ACCEPT', roles: 'HE_THONG', when: 'Khách gửi yêu cầu trực tuyến' },
  { from: 'PENDING_ACCEPT', to: 'RECEIVED', roles: ['TN'], when: 'Nhận máy, lập biên nhận' },
  { from: 'RECEIVED', to: 'PRECHECK', roles: ['CSKH'], when: 'Kiểm tra dữ liệu bảo hành sơ bộ' },
  { from: 'PRECHECK', to: 'WAITING_INFORMATION', roles: ['CSKH'], when: 'Thiếu giấy tờ/serial' },
  { from: 'WAITING_INFORMATION', to: 'PRECHECK', roles: ['CSKH'], when: 'Đã bổ sung' },
  { from: 'PRECHECK', to: 'DIAGNOSING', roles: ['DP'], when: 'Giao kỹ thuật viên chẩn đoán' },
  { from: 'DIAGNOSING', to: 'ELIGIBILITY_REVIEW', roles: ['KTV'], when: 'Đã có biên bản nguyên nhân lỗi' },
  { from: 'ELIGIBILITY_REVIEW', to: 'WAITING_APPROVAL', roles: ['CSKH'], when: 'Ngoại lệ hoặc báo giá vượt ngưỡng' },
  { from: 'WAITING_APPROVAL', to: 'ELIGIBILITY_REVIEW', roles: ['QL'], when: 'Có quyết định phê duyệt' },
  { from: 'ELIGIBILITY_REVIEW', to: 'QUOTED', roles: ['CSKH'], when: 'Sửa có phí, đã gửi báo giá' },
  { from: 'ELIGIBILITY_REVIEW', to: 'WO_CREATED', roles: ['CSKH'], when: 'Đủ điều kiện miễn phí' },
  { from: 'QUOTED', to: 'WO_CREATED', roles: ['CSKH'], when: 'Khách đồng ý báo giá hiện hành' },
  { from: 'QUOTED', to: 'RETURN_PENDING', roles: ['CSKH'], when: 'Khách từ chối sửa' },
  { from: 'ELIGIBILITY_REVIEW', to: 'RETURN_PENDING', roles: ['CSKH'], when: 'Không sửa được/khách từ chối phương án' },
  { from: 'WO_CREATED', to: 'WAITING_PARTS', roles: ['KHO'], when: 'Thiếu linh kiện bắt buộc' },
  { from: 'WAITING_PARTS', to: 'READY_TO_REPAIR', roles: ['KHO'], when: 'Đã đủ linh kiện' },
  { from: 'WO_CREATED', to: 'READY_TO_REPAIR', roles: ['KHO'], when: 'Không cần hoặc đã đủ linh kiện' },
  { from: 'READY_TO_REPAIR', to: 'ASSIGNED', roles: ['DP'], when: 'Phân công kỹ thuật viên' },
  { from: 'ASSIGNED', to: 'IN_REPAIR', roles: ['KTV'], when: 'Thỏa điều kiện BR-13' },
  { from: 'IN_REPAIR', to: 'TESTING', roles: ['KTV'], when: 'Hoàn tất công việc' },
  { from: 'TESTING', to: 'REWORK', roles: ['QC'], when: 'QC không đạt' },
  { from: 'REWORK', to: 'IN_REPAIR', roles: ['KTV'], when: 'Nhận xử lý lại' },
  { from: 'TESTING', to: 'MANAGER_REVIEW', roles: ['QC'], when: 'Sau 2 lần sửa lại vẫn không đạt' },
  { from: 'MANAGER_REVIEW', to: 'IN_REPAIR', roles: ['QL'], when: 'Duyệt sửa tiếp' },
  { from: 'MANAGER_REVIEW', to: 'RETURN_PENDING', roles: ['QL'], when: 'Duyệt dừng sửa, trả thiết bị' },
  { from: 'TESTING', to: 'READY_FOR_DELIVERY', roles: ['QC'], when: 'QC đạt' },
  { from: 'RETURN_PENDING', to: 'READY_FOR_DELIVERY', roles: ['CSKH'], when: 'Có kết luận không sửa hợp lệ' },
  { from: 'READY_FOR_DELIVERY', to: 'COMPLETED', roles: ['TN'], when: 'Đã bàn giao và có xác nhận' },
  { from: 'RECEIVED', to: 'CANCELLED', roles: ['QL'], when: 'Hủy hợp lệ (quản lý duyệt)' },
]

export function canTransition(from: CaseStatus, to: CaseStatus, role: Role) {
  return TRANSITIONS.some(
    (t) => t.from === from && t.to === to && t.roles !== 'HE_THONG' && t.roles.includes(role)
  )
}

// Thứ tự hiển thị thanh tiến trình trên chi tiết phiếu.
export const STAGES: { label: string; statuses: CaseStatus[] }[] = [
  { label: 'Tiếp nhận', statuses: ['DRAFT', 'PENDING_ACCEPT', 'RECEIVED'] },
  { label: 'Kiểm tra sơ bộ', statuses: ['PRECHECK', 'WAITING_INFORMATION'] },
  { label: 'Chẩn đoán', statuses: ['DIAGNOSING'] },
  { label: 'Xét bảo hành', statuses: ['ELIGIBILITY_REVIEW', 'WAITING_APPROVAL', 'QUOTED'] },
  { label: 'Chuẩn bị sửa', statuses: ['WO_CREATED', 'WAITING_PARTS', 'READY_TO_REPAIR', 'ASSIGNED'] },
  { label: 'Sửa chữa', statuses: ['IN_REPAIR', 'REWORK', 'MANAGER_REVIEW'] },
  { label: 'Kiểm tra chất lượng', statuses: ['TESTING'] },
  { label: 'Bàn giao', statuses: ['RETURN_PENDING', 'READY_FOR_DELIVERY', 'COMPLETED'] },
]

export const OPEN_STATUSES = (Object.keys(CASE_STATUS) as CaseStatus[]).filter(
  (s) => !['DRAFT', 'COMPLETED', 'CANCELLED'].includes(s)
)
