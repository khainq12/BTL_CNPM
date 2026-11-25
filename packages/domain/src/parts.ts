import type { Approval, Part, WoPart, WorkOrder } from './types'

// Linh kiện của lệnh sửa chữa (BR-14..17). Dùng chung cho lớp API và giao diện để hai bên tính giống nhau.
// Số "đang chờ mua" không lưu riêng mà tính từ chính các đề nghị mua gắn với lệnh, nên không lệch với thực tế.

// Dữ liệu kho cần để tính: tồn từng linh kiện và các đề nghị mua.
export type StockView = { parts: Part[]; approvals: Approval[] }

// Số còn thiếu của một dòng: chưa giữ, chưa cấp.
export const missingQty = (l: WoPart) => Math.max(0, l.qty - l.reserved - l.issued)

// Tồn khả dụng: có trong kho mà chưa giữ cho lệnh nào.
export function availableQty(db: StockView, partId: string) {
  const p = db.parts.find((x) => x.id === partId)
  return p ? Math.max(0, p.onHand - p.reserved) : 0
}

// Phần chưa nhận hàng của một đề nghị mua: chờ duyệt thì cả đề nghị, đã duyệt thì phần chưa nhập kho.
export function purchaseOpenQty(a: Approval) {
  if (a.type !== 'MUA_LINH_KIEN') return 0
  if (a.status === 'CHO_DUYET') return a.qty ?? 0
  if (a.status === 'DA_DUYET') return Math.max(0, (a.qty ?? 0) - (a.received ?? 0))
  return 0
}

// Đang chờ mua về cho một dòng của lệnh: các đề nghị mua gắn với lệnh còn chưa nhận hàng.
export function onOrderQty(db: StockView, woId: string, partId: string) {
  return db.approvals.reduce((s, a) => (a.woId === woId && a.partId === partId ? s + purchaseOpenQty(a) : s), 0)
}

// Cần đề nghị mua thêm: phần thiếu không có sẵn trong kho và chưa có đề nghị mua đang chờ.
export function toOrderQty(db: StockView, w: WorkOrder, l: WoPart) {
  return Math.max(0, missingQty(l) - onOrderQty(db, w.id, l.partId) - availableQty(db, l.partId))
}

// Kho cần xử lý phần thiếu ngay: có hàng để giữ, hoặc còn phần phải đề nghị mua.
export function shortageNeedsAction(db: StockView, w: WorkOrder) {
  return w.parts.some((l) => missingQty(l) > 0 && (availableQty(db, l.partId) > 0 || toOrderQty(db, w, l) > 0))
}

// Lệnh còn việc cho kho: thiếu linh kiện, có hàng đã giữ chờ cấp phát, hoặc có hàng chờ trả kho.
export const woNeedsWarehouse = (w: WorkOrder) => w.parts.some((p) => missingQty(p) > 0 || p.reserved > 0 || p.returnPending > 0)
