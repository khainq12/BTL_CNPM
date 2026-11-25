import type { PlanChange, WarrantyCase } from './types'

// Đổi phương án khi đang sửa (BR-12): các phép đọc trạng thái dùng chung cho giao diện và lớp API.

const OPEN_CHANGE: PlanChange['status'][] = ['CHO_CSKH', 'CHO_DUYET', 'CHO_GUI', 'CHO_KHACH']

// Đề xuất đang chờ xử lý (tối đa một đề xuất mở cho mỗi phiếu).
export function openChange(c: WarrantyCase) {
  return c.planChanges?.find((x) => OPEN_CHANGE.includes(x.status))
}

// Phương án đang áp dụng: phương án của đề xuất được áp dụng gần nhất, nếu không có thì phương án chẩn đoán.
export function currentPlan(c: WarrantyCase) {
  return c.planChanges?.filter((x) => x.status === 'DA_AP_DUNG').at(-1)?.newPlan ?? c.diagnosis?.plan ?? ''
}
