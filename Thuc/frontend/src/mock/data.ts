// Dữ liệu giả để xem wireframe. Thay bằng API của TV4 khi có Swagger.
import type { CaseStatus } from '../config/statuses'

export interface HistoryEntry {
  at: string // UTC ISO
  actor: string
  text: string
}

export interface WarrantyCase {
  id: string
  version: number
  status: CaseStatus
  customer: { name: string; phone: string }
  asset: { kind: string; model: string; serial: string }
  symptom: string
  accessories: string[]
  channel: 'Quầy' | 'Online'
  owner: string
  receivedAt: string // UTC ISO
  slaDueAt: string // UTC ISO
  slaPaused?: boolean
  blocked?: string
  history: HistoryEntry[]
}

const now = Date.now()
const h = (hours: number) => new Date(now + hours * 3_600_000).toISOString()

export const CASES: WarrantyCase[] = [
  {
    id: 'WC-2026-000124',
    version: 3,
    status: 'VERIFYING',
    customer: { name: 'Nguyễn Thị Lan', phone: '0912 345 678' },
    asset: { kind: 'Laptop', model: 'Dell Latitude 5440', serial: 'DL5440-8KQ2M3' },
    symptom: 'Không lên nguồn sau khi sạc qua đêm, đèn sạc không sáng.',
    accessories: ['Sạc 65W', 'Túi chống sốc'],
    channel: 'Quầy',
    owner: 'Trần Minh (CSKH)',
    receivedAt: h(-20),
    slaDueAt: h(2.5),
    history: [
      { at: h(-20), actor: 'Lê Hà (Tiếp nhận)', text: 'Tạo phiếu tiếp nhận, đính kèm 4 ảnh hiện trạng' },
      { at: h(-19.5), actor: 'Lê Hà (Tiếp nhận)', text: 'Mới → Đã tiếp nhận' },
      { at: h(-3), actor: 'Trần Minh (CSKH)', text: 'Đã tiếp nhận → Đang xác minh' },
    ],
  },
  {
    id: 'WC-2026-000121',
    version: 5,
    status: 'IN_SERVICE',
    customer: { name: 'Phạm Quốc Bảo', phone: '0987 654 321' },
    asset: { kind: 'Máy in', model: 'HP LaserJet M211dw', serial: 'VNB3K21907' },
    symptom: 'Kẹt giấy liên tục ở khay sau, bản in có vệt đen dọc.',
    accessories: ['Cáp nguồn'],
    channel: 'Online',
    owner: 'Võ Thành (Kỹ thuật)',
    receivedAt: h(-50),
    slaDueAt: h(-1.5),
    blocked: 'Chờ linh kiện: cụm sấy RM2-5399, dự kiến 12/11',
    history: [{ at: h(-50), actor: 'Lê Hà (Tiếp nhận)', text: 'Tạo phiếu tiếp nhận' }],
  },
  {
    id: 'WC-2026-000119',
    version: 2,
    status: 'AWAITING_CUSTOMER',
    customer: { name: 'Đỗ Thu Hằng', phone: '0903 112 233' },
    asset: { kind: 'Laptop', model: 'Lenovo ThinkPad E14 Gen 5', serial: 'PF4XZ8LM' },
    symptom: 'Bàn phím mất một số phím hàng trên.',
    accessories: [],
    channel: 'Quầy',
    owner: 'Trần Minh (CSKH)',
    receivedAt: h(-30),
    slaDueAt: h(20),
    slaPaused: true,
    history: [{ at: h(-30), actor: 'Lê Hà (Tiếp nhận)', text: 'Tạo phiếu tiếp nhận' }],
  },
  {
    id: 'WC-2026-000117',
    version: 7,
    status: 'READY_FOR_HANDOVER',
    customer: { name: 'Hoàng Đức Anh', phone: '0938 777 010' },
    asset: { kind: 'PC', model: 'Asus ExpertCenter D700', serial: 'R5PC0A123456' },
    symptom: 'Tự khởi động lại khi chạy tải nặng.',
    accessories: ['Bàn phím', 'Chuột'],
    channel: 'Quầy',
    owner: 'Lê Hà (Tiếp nhận)',
    receivedAt: h(-96),
    slaDueAt: h(30),
    history: [{ at: h(-96), actor: 'Lê Hà (Tiếp nhận)', text: 'Tạo phiếu tiếp nhận' }],
  },
  {
    id: 'WC-2026-000126',
    version: 1,
    status: 'NEW',
    customer: { name: 'Bùi Mai Phương', phone: '0977 456 120' },
    asset: { kind: 'Laptop', model: 'HP ProBook 450 G10', serial: '5CD3419XYZ' },
    symptom: 'Màn hình nhấp nháy khi mở góc lớn hơn 90 độ.',
    accessories: ['Sạc 45W'],
    channel: 'Online',
    owner: 'Chưa phân công',
    receivedAt: h(-1),
    slaDueAt: h(7),
    history: [{ at: h(-1), actor: 'Khách hàng (Portal)', text: 'Gửi yêu cầu online' }],
  },
]
