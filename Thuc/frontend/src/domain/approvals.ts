import type { Tone } from './statuses'
import type { Approval } from './types'

// Nhãn trạng thái đề nghị, dùng chung cho trang Phê duyệt và trang Nhập kho.
// Đề nghị mua đã duyệt thì theo dõi tiếp hàng đã về chưa (ghi nhận lúc nhập kho).
export function approvalStatus(a: Approval): { label: string; tone: Tone } {
  switch (a.status) {
    case 'CHO_DUYET':
      return { label: 'Chờ duyệt', tone: 'wait' }
    case 'TU_CHOI':
      return { label: 'Từ chối', tone: 'bad' }
    case 'DA_HUY':
      return { label: 'Đã hủy', tone: 'neutral' }
    case 'DA_DUYET': {
      if (a.type !== 'MUA_LINH_KIEN') return { label: 'Đã duyệt', tone: 'done' }
      const qty = a.qty ?? 0
      const got = Math.min(a.received ?? 0, qty)
      if (got >= qty) return { label: 'Đã duyệt, đã nhận hàng', tone: 'done' }
      return { label: got > 0 ? `Đã duyệt, đã nhận ${got}/${qty}` : 'Đã duyệt, chờ hàng về', tone: 'info' }
    }
  }
}
