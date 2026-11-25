import { Link } from '@tanstack/react-router'
import { useDb, useMe } from '@/api/hooks'
import { SLA_RANK, slaInfo } from '@/domain/sla'
import type { WarrantyCase } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { Empty, Guard, PageShell, Pill, SlaBadge, StatusBadge } from '@/components/woms'

// S-50 Việc của tôi (kỹ thuật viên): chẩn đoán, sửa, sửa lại. Sắp theo thời hạn.
export function MyWork() {
  return (
    <Guard page='myWork'>
      <Inner />
    </Guard>
  )
}

function Inner() {
  const db = useDb()
  const me = useMe()
  const wo = (c: WarrantyCase) => db.workOrders.find((w) => w.id === c.workOrderId)
  const rows = db.cases
    .filter((c) => (c.status === 'DIAGNOSING' && c.diagnosisTechId === me.id) || (['ASSIGNED', 'IN_REPAIR', 'REWORK'].includes(c.status) && wo(c)?.technicianId === me.id))
    .sort((a, b) => SLA_RANK[slaInfo(a).kind] - SLA_RANK[slaInfo(b).kind])
  const done = db.cases.filter((c) => c.status === 'TESTING' && wo(c)?.technicianId === me.id)

  return (
    <PageShell title='Việc của tôi' description='Mở phiếu để ghi chẩn đoán, đánh dấu công việc và chuyển QC.'>
      {rows.length === 0 ? (
        <Empty className='bg-card rounded-lg border'>Bạn không có việc nào đang chờ. Điều phối viên sẽ giao việc mới.</Empty>
      ) : (
        <ul className='grid gap-3'>
          {rows.map((c) => {
            const d = db.devices.find((x) => x.id === c.deviceId)!
            const w = wo(c)
            const doneTasks = w?.tasks.filter((t) => t.done).length ?? 0
            const missing = w?.parts.some((p) => p.issued < p.qty)
            return (
              <li key={c.id} className='bg-card flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border p-4'>
                <div className='min-w-56 flex-1'>
                  <p className='font-medium'>
                    {d.brand} {d.model} <span className='text-muted-foreground font-normal'>· {c.code}</span>
                  </p>
                  <p className='text-muted-foreground text-sm'>
                    {c.status === 'DIAGNOSING' ? `Khách báo: ${c.symptom}` : c.status === 'REWORK' ? `QC báo lỗi: ${c.qc.at(-1)?.defect}` : `${w?.code}: ${doneTasks}/${w?.tasks.length} công việc xong`}
                  </p>
                </div>
                <StatusBadge status={c.status} />
                <SlaBadge c={c} />
                {missing && c.status !== 'DIAGNOSING' && <Pill tone='wait'>Chờ kho cấp linh kiện</Pill>}
                <Button asChild size='sm'>
                  <Link to='/phieu/$id' params={{ id: c.id }}>
                    Mở phiếu
                  </Link>
                </Button>
              </li>
            )
          })}
        </ul>
      )}
      {done.length > 0 && <p className='text-muted-foreground text-sm'>{done.length} thiết bị bạn sửa đang chờ QC kiểm tra.</p>}
    </PageShell>
  )
}
