import type { Role } from './types'

// 7 vai trò nội bộ theo ma trận phân quyền (Phần 5.3, PARAM-12). Khách hàng dùng Customer Portal (TV7).
export const ROLE_LABEL: Record<Role, string> = {
  TN: 'Nhân viên tiếp nhận',
  CSKH: 'Nhân viên CSKH/bảo hành',
  DP: 'Điều phối viên',
  KTV: 'Kỹ thuật viên',
  KHO: 'Nhân viên kho',
  QC: 'Nhân viên kiểm tra chất lượng',
  QL: 'Quản lý',
}

export const ROLE_SHORT: Record<Role, string> = {
  TN: 'Tiếp nhận',
  CSKH: 'CSKH',
  DP: 'Điều phối',
  KTV: 'Kỹ thuật viên',
  KHO: 'Kho',
  QC: 'QC',
  QL: 'Quản lý',
}

// Quyền truy cập theo trang (route). Nguồn: ma trận phân quyền 5.3, cột "Xem".
export const PAGE_ROLES = {
  inbox: ['TN', 'CSKH', 'DP', 'KTV', 'KHO', 'QC', 'QL'],
  cases: ['TN', 'CSKH', 'DP', 'QL'],
  caseDetail: ['TN', 'CSKH', 'DP', 'KTV', 'KHO', 'QC', 'QL'],
  intake: ['TN'],
  online: ['TN', 'QL'],
  customers: ['TN', 'CSKH', 'QL'],
  device: ['TN', 'CSKH', 'DP', 'KTV', 'QC', 'QL'],
  dispatch: ['DP', 'QL'],
  myWork: ['KTV'],
  qcQueue: ['QC'],
  handoverQueue: ['TN', 'CSKH'],
  inventory: ['KHO', 'DP', 'KTV', 'QL'],
  partRequests: ['KHO'],
  stockIn: ['KHO', 'QL'],
  stocktake: ['KHO'],
  stockHistory: ['KHO', 'QL'],
  approvals: ['QL'],
  complaints: ['CSKH', 'QL'],
  users: ['QL'],
  audit: ['QL'],
  calendar: ['QL'],
} satisfies Record<string, Role[]>

export type PageKey = keyof typeof PAGE_ROLES

export function canSee(role: Role | undefined, page: PageKey) {
  return !!role && (PAGE_ROLES[page] as Role[]).includes(role)
}
