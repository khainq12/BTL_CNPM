import {
  Boxes,
  ClipboardCheck,
  ClipboardList,
  ClipboardPlus,
  FileClock,
  Globe,
  HandHelping,
  History,
  Inbox,
  MessageSquareWarning,
  PackageCheck,
  PackageOpen,
  PackagePlus,
  ScrollText,
  ShieldCheck,
  Stamp,
  UserCog,
  Users,
  Workflow,
  Wrench,
} from 'lucide-react'
import type { PageKey } from '@/domain/roles'

export type NavDef = { title: string; url: string; icon: React.ElementType; page: PageKey; badgeKey?: string }

export const NAV: { title: string; items: NavDef[] }[] = [
  {
    title: 'Công việc',
    items: [
      { title: 'Hộp việc', url: '/', icon: Inbox, page: 'inbox' },
      { title: 'Việc của tôi', url: '/viec-cua-toi', icon: Wrench, page: 'myWork', badgeKey: 'myWork' },
      { title: 'Bảng điều phối', url: '/dieu-phoi', icon: Workflow, page: 'dispatch', badgeKey: 'dispatch' },
      { title: 'Chờ kiểm tra chất lượng', url: '/kiem-dinh', icon: ClipboardCheck, page: 'qcQueue', badgeKey: 'qc' },
      { title: 'Phê duyệt', url: '/phe-duyet', icon: Stamp, page: 'approvals', badgeKey: 'approvals' },
    ],
  },
  {
    title: 'Tiếp nhận và phiếu',
    items: [
      { title: 'Tạo phiếu tiếp nhận', url: '/tiep-nhan/moi', icon: ClipboardPlus, page: 'intake' },
      { title: 'Yêu cầu trực tuyến', url: '/tiep-nhan/online', icon: Globe, page: 'online', badgeKey: 'online' },
      { title: 'Danh sách phiếu', url: '/phieu', icon: ClipboardList, page: 'cases' },
      { title: 'Chờ bàn giao', url: '/ban-giao', icon: HandHelping, page: 'handoverQueue', badgeKey: 'handover' },
      { title: 'Khách hàng', url: '/khach-hang', icon: Users, page: 'customers' },
      { title: 'Khiếu nại', url: '/khieu-nai', icon: MessageSquareWarning, page: 'complaints', badgeKey: 'complaints' },
    ],
  },
  {
    title: 'Kho linh kiện',
    items: [
      { title: 'Yêu cầu linh kiện', url: '/kho/yeu-cau', icon: PackageOpen, page: 'partRequests', badgeKey: 'parts' },
      { title: 'Tồn kho', url: '/kho', icon: Boxes, page: 'inventory' },
      { title: 'Nhập kho và mua thêm', url: '/kho/nhap', icon: PackagePlus, page: 'stockIn' },
      { title: 'Kiểm kê', url: '/kho/kiem-ke', icon: PackageCheck, page: 'stocktake' },
      { title: 'Lịch sử kho', url: '/kho/lich-su', icon: History, page: 'stockHistory' },
    ],
  },
  {
    title: 'Quản trị',
    items: [
      { title: 'Tài khoản và phân quyền', url: '/quan-tri/tai-khoan', icon: UserCog, page: 'users' },
      { title: 'Nhật ký thao tác', url: '/quan-tri/nhat-ky', icon: ScrollText, page: 'audit' },
    ],
  },
]

export const APP = { name: 'WOMS', subtitle: 'Trung tâm bảo hành', icon: ShieldCheck, fileIcon: FileClock }
