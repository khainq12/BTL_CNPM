import { useDb, useMe } from '@/api/hooks'

// Số đếm trên menu: việc đang chờ vai trò hiện tại.
export function useNavCounts(): Record<string, number> {
  const db = useDb()
  const me = useMe()
  const wo = (id?: string) => db.workOrders.find((w) => w.id === id)
  return {
    myWork: db.cases.filter(
      (c) =>
        (c.status === 'DIAGNOSING' && c.diagnosisTechId === me.id) ||
        (['ASSIGNED', 'IN_REPAIR', 'REWORK'].includes(c.status) && wo(c.workOrderId)?.technicianId === me.id)
    ).length,
    dispatch: db.cases.filter((c) => c.status === 'PRECHECK' || c.status === 'READY_TO_REPAIR').length,
    qc: db.cases.filter((c) => c.status === 'TESTING').length,
    approvals: db.approvals.filter((a) => a.status === 'CHO_DUYET').length,
    online: db.cases.filter((c) => c.status === 'PENDING_ACCEPT').length,
    handover: db.cases.filter((c) => c.status === 'READY_FOR_DELIVERY' || (me.role === 'CSKH' && c.status === 'RETURN_PENDING')).length,
    complaints: db.complaints.filter((q) => q.status !== 'DA_GIAI_QUYET' && (me.role !== 'QL' || q.status === 'CHUYEN_QUAN_LY')).length,
    parts: db.workOrders.filter((w) => {
      const c = db.cases.find((x) => x.id === w.caseId)
      return (
        c &&
        !['COMPLETED', 'CANCELLED'].includes(c.status) &&
        w.parts.some((p) => p.reserved + p.issued < p.qty || p.reserved > 0 || p.returnPending > 0)
      )
    }).length,
  }
}
