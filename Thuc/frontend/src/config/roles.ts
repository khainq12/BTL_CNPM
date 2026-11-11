// Vai trò nội bộ. Một người có thể kiêm nhiều vai trò (chờ TV2 chốt).
export type Role = 'TN' | 'CS' | 'KT' | 'DP' | 'KHO' | 'QC' | 'QL'

export const ROLES: Record<Role, string> = {
  TN: 'Tiếp nhận',
  CS: 'CSKH bảo hành',
  KT: 'Kỹ thuật viên',
  DP: 'Điều phối',
  KHO: 'Kho',
  QC: 'Kiểm định',
  QL: 'Quản lý',
}

export interface NavItem {
  path: string
  label: string
  roles: Role[]
}

// Menu hiện theo quyền. Các mục chưa làm trỏ tới trang "chưa có wireframe".
export const NAV: NavItem[] = [
  { path: '/hop-viec', label: 'Hộp việc', roles: ['TN', 'CS', 'KT', 'DP', 'KHO', 'QC', 'QL'] },
  { path: '/tiep-nhan/moi', label: 'Tạo phiếu tiếp nhận', roles: ['TN'] },
  { path: '/case', label: 'Danh sách phiếu', roles: ['TN', 'CS', 'DP', 'QL'] },
  { path: '/dieu-phoi', label: 'Bảng điều phối', roles: ['DP'] },
  { path: '/viec-cua-toi', label: 'Việc của tôi', roles: ['KT'] },
  { path: '/kiem-dinh', label: 'Chờ kiểm định', roles: ['QC'] },
  { path: '/kho', label: 'Kho linh kiện', roles: ['KHO', 'DP', 'KT'] },
  { path: '/phe-duyet', label: 'Chờ phê duyệt', roles: ['QL'] },
]
