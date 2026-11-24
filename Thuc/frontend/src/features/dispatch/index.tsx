import { useState } from 'react'
import { useDb, useMe } from '@/api/hooks'
import { fmtMinutes } from '@/domain/format'
import { PARAMS } from '@/domain/params'
import type { WarrantyCase } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CaseLink, Empty, Guard, PageShell, Pill, Section, SlaBadge, StatusBadge, UserAvatar, useName } from '@/components/woms'
import { cn } from '@/lib/utils'
import { ActionDialog } from '@/features/cases/actions'
import { techLoad } from '@/features/cases/logic'

// S-42 Bảng điều phối (UC-10): giao chẩn đoán, phân công sửa, theo dõi tải kỹ thuật viên.
export function Dispatch() {
  return (
    <Guard page='dispatch'>
      <Inner />
    </Guard>
  )
}

function Inner() {
  const db = useDb()
  const me = useMe()
  const name = useName()
  const [pick, setPick] = useState<{ c: WarrantyCase; kind: 'assignDiagnosis' | 'assignRepair' } | null>(null)
  const isDp = me.role === 'DP'
  const waitDiag = db.cases.filter((c) => c.status === 'PRECHECK')
  const waitRepair = db.cases.filter((c) => c.status === 'READY_TO_REPAIR')
  const techs = db.users.filter((u) => u.role === 'KTV' && u.active)
  const active = db.cases.filter((c) => ['DIAGNOSING', 'ASSIGNED', 'IN_REPAIR', 'REWORK', 'TESTING'].includes(c.status))

  return (
    <PageShell title='Bảng điều phối' description={isDp ? 'Giao việc theo chuyên môn và tải hiện tại. Đổi người phụ trách phải ghi lý do.' : 'Chế độ xem của quản lý.'}>
      <section aria-label='Tải kỹ thuật viên' className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
        {techs.map((t) => {
          const l = techLoad(db, t.id)
          const minutes = db.workOrders.filter((w) => w.technicianId === t.id).flatMap((w) => w.tasks.filter((x) => !x.done)).reduce((s, x) => s + x.minutes, 0)
          return (
            <div key={t.id} className='bg-card grid gap-3 rounded-lg border p-4'>
              <div className='flex items-center gap-3'>
                <UserAvatar id={t.id} className='size-9 text-xs' />
                <div className='min-w-0 flex-1'>
                  <p className='font-medium'>{t.name}</p>
                  <p className='text-muted-foreground text-sm'>
                    {l.wo} lệnh sửa · {l.diag} chẩn đoán · còn khoảng {fmtMinutes(minutes)}
                  </p>
                </div>
                {l.overloaded ? <Pill tone='wait'>Quá tải</Pill> : <Pill>Bình thường</Pill>}
              </div>
              <div
                role='meter'
                aria-label={`Số việc dở dang của ${t.name}`}
                aria-valuemin={0}
                aria-valuemax={PARAMS.technicianOverload}
                aria-valuenow={l.total}
                className={cn('h-1.5 overflow-hidden rounded-full', l.overloaded ? 'bg-amber-100 dark:bg-amber-950' : 'bg-meter-ok-track')}
              >
                <div className={cn('h-full rounded-full', l.overloaded ? 'bg-amber-500' : 'bg-meter-ok')} style={{ width: `${Math.min(100, Math.max(l.total ? 4 : 0, (l.total / PARAMS.technicianOverload) * 100))}%` }} />
              </div>
            </div>
          )
        })}
      </section>

      <Section title={`Chờ giao chẩn đoán (${waitDiag.length})`} description='CSKH đã kiểm tra sơ bộ.'>
        <Queue rows={waitDiag} action={isDp ? (c) => setPick({ c, kind: 'assignDiagnosis' }) : undefined} label='Giao chẩn đoán' />
      </Section>
      <Section title={`Sẵn sàng sửa, chờ phân công (${waitRepair.length})`} description='Phương án đã xác nhận, kho đã giữ đủ linh kiện.'>
        <Queue rows={waitRepair} action={isDp ? (c) => setPick({ c, kind: 'assignRepair' }) : undefined} label='Phân công' />
      </Section>
      <Section title={`Đang xử lý (${active.length})`}>
        {active.length === 0 ? (
          <Empty>Không có việc đang xử lý.</Empty>
        ) : (
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phiếu</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Thời hạn</TableHead>
                  <TableHead>Kỹ thuật viên</TableHead>
                  {isDp && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {active.map((c) => {
                  const wo = db.workOrders.find((w) => w.id === c.workOrderId)
                  const tech = c.status === 'DIAGNOSING' ? c.diagnosisTechId : wo?.technicianId
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <CaseLink c={c} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={c.status} />
                      </TableCell>
                      <TableCell>
                        <SlaBadge c={c} />
                      </TableCell>
                      <TableCell>{name(tech)}</TableCell>
                      {isDp && (
                        <TableCell className='text-right'>
                          {c.status !== 'TESTING' && (
                            <Button size='sm' variant='outline' onClick={() => setPick({ c, kind: c.status === 'DIAGNOSING' ? 'assignDiagnosis' : 'assignRepair' })}>
                              Đổi người
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>
      <p className='text-muted-foreground text-xs'>Quá tải: trên {PARAMS.technicianOverload} việc dở dang (UC-10).</p>
      {pick && <ActionDialog action={pick.kind} c={pick.c} wo={db.workOrders.find((w) => w.id === pick.c.workOrderId)} onClose={() => setPick(null)} />}
    </PageShell>
  )
}

function Queue({ rows, action, label }: { rows: WarrantyCase[]; action?: (c: WarrantyCase) => void; label: string }) {
  const db = useDb()
  if (rows.length === 0) return <Empty>Không có việc chờ.</Empty>
  return (
    <ul className='divide-y'>
      {rows.map((c) => {
        const d = db.devices.find((x) => x.id === c.deviceId)!
        const wo = db.workOrders.find((w) => w.id === c.workOrderId)
        return (
          <li key={c.id} className='flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm'>
            <span className='w-44'>
              <CaseLink c={c} />
            </span>
            <span className='min-w-40 flex-1'>
              {d.brand} {d.model}
              <span className='text-muted-foreground'> · {wo ? `${wo.code}, ${fmtMinutes(wo.tasks.reduce((s, t) => s + t.minutes, 0))}` : c.symptom}</span>
            </span>
            <SlaBadge c={c} />
            {action && (
              <Button size='sm' onClick={() => action(c)}>
                {label}
              </Button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
