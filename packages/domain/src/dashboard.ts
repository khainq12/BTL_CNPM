import type { Db } from './db'
import { slaInfo, type SlaKind } from './sla'
import { OPEN_STATUSES, STAGES } from './statuses'

// Chỉ số cho bảng điều hành của quản lý (Dashboard cơ bản, TV7-10..12; TC-057).
export type DashboardKpi = {
  generatedAt: string
  openCases: number
  completedCases: number
  cancelledCases: number
  sla: Record<SlaKind, number>
  onTimeRate: number | null // tỷ lệ phiếu đã sẵn sàng bàn giao trước hạn, trên các phiếu đã có hạn
  reworkRate: number | null // số phiếu có ít nhất 1 lần sửa lại / số phiếu đã qua QC
  avgRepairHours: number | null // từ lúc xác nhận phương án tới khi sẵn sàng bàn giao (giờ đồng hồ)
  byStage: { label: string; count: number }[]
  byTechnician: { id: string; name: string; open: number; done: number }[]
  pendingApprovals: number
  lowStockParts: { sku: string; name: string; available: number }[]
}

export function dashboard(db: Db, now = Date.now(), minStock = 5): DashboardKpi {
  const sla = { not_started: 0, ok: 0, soon: 0, overdue: 0, paused: 0, stopped: 0, pickup: 0, pickup_late: 0 } as Record<SlaKind, number>
  const open = db.cases.filter((c) => OPEN_STATUSES.includes(c.status))
  for (const c of open) sla[slaInfo(c, now).kind] += 1

  const finished = db.cases.filter((c) => c.readyAt && c.sla.planConfirmedAt && c.qc.some((q) => q.pass))
  let onTime = 0
  let hours = 0
  for (const c of finished) {
    const s = slaInfo({ ...c, status: 'IN_REPAIR' }, Date.parse(c.readyAt!))
    if (s.kind !== 'overdue') onTime += 1
    hours += (Date.parse(c.readyAt!) - Date.parse(c.sla.planConfirmedAt!)) / 3_600_000
  }
  const qcd = db.cases.filter((c) => c.qc.length > 0)
  const reworked = qcd.filter((c) => c.reworkCount > 0 || c.qc.some((q) => !q.pass))

  const techs = db.users.filter((u) => u.role === 'KTV')
  const byTechnician = techs.map((t) => {
    const wos = db.workOrders.filter((w) => w.technicianId === t.id)
    const st = (id: string) => db.cases.find((c) => c.id === id)?.status
    return {
      id: t.id,
      name: t.name,
      open:
        wos.filter((w) => ['ASSIGNED', 'IN_REPAIR', 'REWORK'].includes(st(w.caseId) ?? '')).length +
        db.cases.filter((c) => c.status === 'DIAGNOSING' && c.diagnosisTechId === t.id).length,
      done: wos.filter((w) => !!w.finishedAt).length,
    }
  })

  return {
    generatedAt: new Date(now).toISOString(),
    openCases: open.length,
    completedCases: db.cases.filter((c) => c.status === 'COMPLETED').length,
    cancelledCases: db.cases.filter((c) => c.status === 'CANCELLED').length,
    sla,
    onTimeRate: finished.length ? onTime / finished.length : null,
    reworkRate: qcd.length ? reworked.length / qcd.length : null,
    avgRepairHours: finished.length ? Math.round((hours / finished.length) * 10) / 10 : null,
    byStage: STAGES.map((s) => ({ label: s.label, count: open.filter((c) => s.statuses.includes(c.status)).length })),
    byTechnician,
    pendingApprovals: db.approvals.filter((a) => a.status === 'CHO_DUYET').length,
    lowStockParts: db.parts
      .map((p) => ({ sku: p.sku, name: p.name, available: p.onHand - p.reserved }))
      .filter((p) => p.available < minStock)
      .sort((a, b) => a.available - b.available),
  }
}
