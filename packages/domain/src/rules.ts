import type { CauseType, DeviceKind, EligibilityDecision, WarrantyCheck } from './types'

export const DEVICE_KIND_LABEL: Record<DeviceKind, string> = {
  laptop: 'Laptop',
  pc: 'Máy tính để bàn',
  printer: 'Máy in',
}

export const ACCESSORIES = ['Sạc / adapter', 'Cáp nguồn', 'Túi chống sốc', 'Chuột', 'Hộp máy', 'Hộp mực']

export const WARRANTY_CHECK_LABEL: Record<WarrantyCheck, string> = {
  CON_HAN: 'Còn hạn bảo hành',
  HET_HAN: 'Hết hạn bảo hành',
  CHUA_DU_THONG_TIN: 'Chưa đủ thông tin',
}

export const CAUSE_LABEL: Record<CauseType, string> = {
  PHAN_CUNG: 'Lỗi phần cứng',
  PHAN_MEM: 'Lỗi phần mềm',
  NUOC_ROI_VO: 'Rơi vỡ / vào nước',
  TU_THAO_LAP: 'Tự ý tháo lắp, can thiệp',
  CHUA_XAC_DINH: 'Chưa xác định',
}

export const DECISION_LABEL: Record<EligibilityDecision, string> = {
  MIEN_PHI: 'Bảo hành miễn phí',
  CO_PHI: 'Sửa có phí',
  NGOAI_LE: 'Đề nghị ngoại lệ (quản lý duyệt)',
  KHONG_SUA: 'Không sửa, trả thiết bị',
}

// Bảng quyết định D1–D10 (Phần 5.2). Dùng để gợi ý, CSKH vẫn là người kết luận (C01).
export const DECISION_RULES: { code: string; when: string; decision: EligibilityDecision }[] = [
  { code: 'D1', when: 'Còn bảo hành, lỗi thuộc phạm vi bảo hành', decision: 'MIEN_PHI' },
  { code: 'D2', when: 'Còn bảo hành sau sửa chữa, lỗi thuộc lần sửa trước', decision: 'MIEN_PHI' },
  { code: 'D3', when: 'Hết bảo hành, thiết bị sửa được', decision: 'CO_PHI' },
  { code: 'D4', when: 'Còn bảo hành nhưng rơi vỡ / vào nước', decision: 'CO_PHI' },
  { code: 'D5', when: 'Còn bảo hành nhưng tự ý tháo lắp', decision: 'CO_PHI' },
  { code: 'D6', when: 'Chưa đủ thông tin xác minh', decision: 'NGOAI_LE' },
  { code: 'D7', when: 'Còn bảo hành, chưa xác định nguyên nhân', decision: 'NGOAI_LE' },
  { code: 'D8', when: 'Hết bảo hành, khách yêu cầu sửa/thay linh kiện', decision: 'CO_PHI' },
  { code: 'D9', when: 'Còn bảo hành, lỗi phần mềm thuộc phạm vi', decision: 'MIEN_PHI' },
  { code: 'D10', when: 'Không thể sửa tại trung tâm', decision: 'KHONG_SUA' },
]

export function suggestRule(warranty: WarrantyCheck | undefined, cause: CauseType | undefined, repairable: boolean | undefined) {
  if (repairable === false) return 'D10'
  if (warranty === 'CHUA_DU_THONG_TIN' || !warranty) return 'D6'
  if (warranty === 'HET_HAN') return 'D3'
  switch (cause) {
    case 'NUOC_ROI_VO':
      return 'D4'
    case 'TU_THAO_LAP':
      return 'D5'
    case 'PHAN_MEM':
      return 'D9'
    case 'CHUA_XAC_DINH':
      return 'D7'
    default:
      return 'D1'
  }
}

// Checklist QC theo loại thiết bị (BR-20). Nội dung tiêu chí do TV6 đề xuất, chờ TV2 xác nhận.
export const QC_CHECKLIST: Record<DeviceKind, { label: string; mandatory: boolean }[]> = {
  laptop: [
    { label: 'Lên nguồn, khởi động vào hệ điều hành', mandatory: true },
    { label: 'Lỗi khách báo đã được khắc phục', mandatory: true },
    { label: 'Màn hình hiển thị bình thường', mandatory: true },
    { label: 'Bàn phím, touchpad hoạt động', mandatory: true },
    { label: 'Sạc pin, nhận adapter', mandatory: true },
    { label: 'Cổng USB, âm thanh, wifi', mandatory: false },
    { label: 'Vỏ máy không phát sinh trầy xước mới', mandatory: true },
  ],
  pc: [
    { label: 'Lên nguồn, khởi động vào hệ điều hành', mandatory: true },
    { label: 'Lỗi khách báo đã được khắc phục', mandatory: true },
    { label: 'Chạy thử tải nặng 15 phút không treo', mandatory: true },
    { label: 'Cổng kết nối, mạng', mandatory: false },
    { label: 'Vỏ máy không phát sinh trầy xước mới', mandatory: true },
  ],
  printer: [
    { label: 'Lên nguồn, không báo lỗi', mandatory: true },
    { label: 'Lỗi khách báo đã được khắc phục', mandatory: true },
    { label: 'In thử trang mẫu rõ nét, không kẹt giấy', mandatory: true },
    { label: 'Kết nối USB / mạng', mandatory: false },
  ],
}

export const CONFIRM_METHODS = [
  'Ký xác nhận tại quầy',
  'Xác nhận qua Customer Portal',
  'Mã OTP gửi tới số điện thoại khách',
  'Gọi điện có ghi âm, quản lý duyệt',
]

export const INFO_REQUEST_REASONS = [
  'Thiếu hóa đơn / phiếu bảo hành',
  'Không tìm thấy serial trong dữ liệu bảo hành',
  'Serial trên máy không khớp chứng từ',
  'Cần khách xác nhận thông tin liên hệ',
]

// Gợi ý kết quả kiểm tra sơ bộ từ ngày mua (C05: không có chứng từ thì "chưa đủ thông tin").
export function warrantyAuto(purchaseDate: string | undefined, months: number, now = Date.now()): WarrantyCheck {
  if (!purchaseDate) return 'CHUA_DU_THONG_TIN'
  return now - Date.parse(purchaseDate) < months * 30.44 * 86400_000 ? 'CON_HAN' : 'HET_HAN'
}
