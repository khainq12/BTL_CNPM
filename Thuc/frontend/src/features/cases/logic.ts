import { PARAMS } from '@/domain/params'
import type { User, WarrantyCase, WorkOrder } from '@/domain/types'
import type { Db } from '@/mock/db'
import { openChange } from '@/api/service'

// Ai được mở chi tiết phiếu (ma trận phân quyền 5.3; AT-14: từ chối kể cả khi biết mã phiếu).
export function canViewCase(me: User, c: WarrantyCase, wo?: WorkOrder) {
  switch (me.role) {
    case 'KTV':
      return c.diagnosisTechId === me.id || wo?.technicianId === me.id || !!wo?.assignHistory.some((h) => h.to === me.id)
    case 'KHO':
      return !!wo
    case 'QC':
      return !!wo && (c.status === 'TESTING' || c.qc.some((q) => q.by === me.id))
    default:
      return true
  }
}

// Thông tin liên hệ khách: KTV, kho, QC không được xem (hàng 1 ma trận 5.3).
export function canSeeCustomer(me: User) {
  return ['TN', 'CSKH', 'DP', 'QL'].includes(me.role)
}

export type ActionKey =
  | 'acceptOnline'
  | 'cancel'
  | 'precheck'
  | 'requestInfo'
  | 'infoSupplied'
  | 'assignDiagnosis'
  | 'diagnosis'
  | 'eligibility'
  | 'sendQuote'
  | 'quoteResponse'
  | 'warehouse'
  | 'assignRepair'
  | 'startRepair'
  | 'finishRepair'
  | 'planChange'
  | 'planReview'
  | 'planSendQuote'
  | 'planResponse'
  | 'qc'
  | 'returnConfirm'
  | 'handover'
  | 'complaint'
  | 'approval'

export type Action = { key: ActionKey; label: string; primary?: boolean; disabled?: string }

export function techLoad(db: Db, techId: string) {
  const wo = db.workOrders.filter((w) => {
    const c = db.cases.find((x) => x.id === w.caseId)
    return w.technicianId === techId && c && ['ASSIGNED', 'IN_REPAIR', 'REWORK'].includes(c.status)
  }).length
  const diag = db.cases.filter((c) => c.status === 'DIAGNOSING' && c.diagnosisTechId === techId).length
  return { wo, diag, total: wo + diag, overloaded: wo + diag > PARAMS.technicianOverload }
}

export function nextActions(me: User, c: WarrantyCase, wo: WorkOrder | undefined): Action[] {
  const a: Action[] = []
  const pending = c.pendingApprovalId ? 'Đang chờ quản lý duyệt đề nghị trước đó.' : undefined
  switch (me.role) {
    case 'TN':
      if (c.status === 'PENDING_ACCEPT') a.push({ key: 'acceptOnline', label: 'Nhận máy, lập biên nhận', primary: true })
      if (c.status === 'READY_FOR_DELIVERY') a.push({ key: 'handover', label: 'Bàn giao thiết bị', primary: true })
      if (c.status === 'RECEIVED') a.push({ key: 'cancel', label: 'Đề nghị hủy phiếu', disabled: pending })
      break
    case 'CSKH':
      if (c.status === 'RECEIVED') a.push({ key: 'precheck', label: 'Kiểm tra sơ bộ', primary: true }, { key: 'cancel', label: 'Đề nghị hủy phiếu', disabled: pending })
      if (c.status === 'PRECHECK') a.push({ key: 'precheck', label: 'Sửa kết quả kiểm tra sơ bộ' }, { key: 'requestInfo', label: 'Yêu cầu khách bổ sung' })
      if (c.status === 'WAITING_INFORMATION') a.push({ key: 'infoSupplied', label: 'Khách đã bổ sung', primary: true })
      if (c.status === 'ELIGIBILITY_REVIEW') {
        const q = c.quotes.at(-1)
        if (q?.status === 'DA_DUYET') a.push({ key: 'sendQuote', label: 'Gửi báo giá đã duyệt cho khách', primary: true })
        a.push({ key: 'eligibility', label: q?.status === 'DA_DUYET' ? 'Kết luận lại' : 'Kết luận bảo hành', primary: q?.status !== 'DA_DUYET' })
      }
      if (c.status === 'QUOTED') a.push({ key: 'quoteResponse', label: 'Ghi nhận phản hồi của khách', primary: true })
      if (c.status === 'RETURN_PENDING') a.push({ key: 'returnConfirm', label: 'Kết luận trả không sửa', primary: true })
      if (c.status === 'COMPLETED') a.push({ key: 'complaint', label: 'Ghi nhận khiếu nại' })
      if (c.status === 'IN_REPAIR') {
        const ch = openChange(c)
        if (ch?.status === 'CHO_CSKH') a.push({ key: 'planReview', label: 'Xét đề xuất đổi phương án', primary: true })
        if (ch?.status === 'CHO_GUI') a.push({ key: 'planSendQuote', label: 'Gửi báo giá bổ sung đã duyệt', primary: true })
        if (ch?.status === 'CHO_KHACH') a.push({ key: 'planResponse', label: 'Ghi nhận phản hồi báo giá bổ sung', primary: true })
      }
      break
    case 'DP':
      if (c.status === 'PRECHECK') a.push({ key: 'assignDiagnosis', label: 'Giao kỹ thuật viên chẩn đoán', primary: true })
      if (c.status === 'DIAGNOSING') a.push({ key: 'assignDiagnosis', label: 'Đổi kỹ thuật viên chẩn đoán' })
      if (c.status === 'READY_TO_REPAIR') a.push({ key: 'assignRepair', label: 'Phân công sửa chữa', primary: true })
      if (['ASSIGNED', 'IN_REPAIR', 'REWORK'].includes(c.status)) a.push({ key: 'assignRepair', label: 'Đổi kỹ thuật viên sửa' })
      break
    case 'KTV':
      if (c.status === 'DIAGNOSING' && c.diagnosisTechId === me.id) a.push({ key: 'diagnosis', label: 'Ghi biên bản chẩn đoán', primary: true })
      if (wo?.technicianId === me.id) {
        const missing = wo.parts.some((p) => p.issued < p.qty)
        if (c.status === 'ASSIGNED' || c.status === 'REWORK')
          a.push({ key: 'startRepair', label: c.status === 'REWORK' ? 'Nhận xử lý lại' : 'Bắt đầu sửa', primary: true, disabled: missing ? 'Chưa nhận đủ linh kiện từ kho (BR-13).' : undefined })
        if (c.status === 'IN_REPAIR') {
          const ch = openChange(c)
          a.push({
            key: 'finishRepair',
            label: 'Hoàn tất, chuyển QC',
            primary: true,
            disabled: ch
              ? 'Đang chờ xác nhận đổi phương án (BR-12).'
              : wo.tasks.some((t) => !t.done)
                ? 'Còn công việc chưa đánh dấu hoàn thành (BR-19).'
                : missing
                  ? 'Chưa nhận đủ linh kiện bổ sung từ kho.'
                  : undefined,
          })
          a.push({ key: 'planChange', label: 'Đề xuất đổi phương án', disabled: ch ? 'Đã có đề xuất đang chờ xử lý.' : undefined })
        }
      }
      break
    case 'KHO':
      if (wo && wo.parts.some((p) => p.reserved + p.issued < p.qty || p.reserved > 0 || p.returnPending > 0)) a.push({ key: 'warehouse', label: 'Xử lý linh kiện', primary: true })
      break
    case 'QC':
      if (c.status === 'TESTING') a.push({ key: 'qc', label: 'Kiểm tra chất lượng', primary: true, disabled: wo?.technicianId === me.id ? 'Người kiểm tra phải khác người sửa.' : undefined })
      break
    case 'QL':
      if (c.pendingApprovalId) a.push({ key: 'approval', label: 'Xem đề nghị chờ duyệt', primary: true })
      break
  }
  return a
}
