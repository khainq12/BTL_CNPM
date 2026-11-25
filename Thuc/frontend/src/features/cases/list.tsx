import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useDb, useMe } from '@/api/hooks'
import { canSee } from '@/domain/roles'
import { fmtDateTime } from '@/domain/format'
import { SLA_RANK, slaInfo } from '@/domain/sla'
import { CASE_STATUS, OPEN_STATUSES } from '@/domain/statuses'
import type { CaseStatus, WarrantyCase } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { NativeSelect } from '@/components/form-kit'
import { CaseLink, DeviceIcon, Empty, Guard, PageShell, SlaBadge, StatusBadge, UserChip } from '@/components/woms'

const PAGE = 15

export function CaseList() {
  return (
    <Guard page='cases'>
      <List />
    </Guard>
  )
}

function List() {
  const db = useDb()
  const me = useMe()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'' | 'OPEN' | CaseStatus>('OPEN')
  const [sla, setSla] = useState('')
  const [page, setPage] = useState(0)

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase().replace(/\s/g, '')
    return db.cases
      .filter((c) => (status === 'OPEN' ? OPEN_STATUSES.includes(c.status) : !status || c.status === status))
      .filter((c) => {
        if (!term) return true
        const cu = db.customers.find((x) => x.id === c.customerId)!
        // BR-11: tìm theo mã phiếu, SĐT, tên khách. Không tìm theo serial.
        return c.code.toLowerCase().includes(term) || cu.phone.includes(term) || cu.name.toLowerCase().replace(/\s/g, '').includes(term)
      })
      .filter((c) => !sla || slaInfo(c).kind === sla)
      .sort((a, b) => SLA_RANK[slaInfo(a).kind] - SLA_RANK[slaInfo(b).kind] || b.createdAt.localeCompare(a.createdAt))
  }, [db, q, status, sla])

  const pageRows = rows.slice(page * PAGE, page * PAGE + PAGE)
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))

  return (
    <PageShell
      title='Danh sách phiếu'
      description={`${rows.length} phiếu`}
      actions={
        canSee(me.role, 'intake') && (
          <Button asChild>
            <Link to='/tiep-nhan/moi'>Tạo phiếu tiếp nhận</Link>
          </Button>
        )
      }
    >
      <form role='search' className='flex flex-wrap items-end gap-3' onSubmit={(e) => e.preventDefault()}>
        <label className='grid min-w-64 flex-1 gap-1.5 text-sm font-medium'>
          Tìm phiếu
          <Input value={q} onChange={(e) => (setQ(e.target.value), setPage(0))} placeholder='Mã phiếu, số điện thoại hoặc tên khách' />
        </label>
        <label className='grid gap-1.5 text-sm font-medium'>
          Trạng thái
          <NativeSelect value={status} onChange={(e) => (setStatus(e.target.value as typeof status), setPage(0))} className='w-56'>
            <option value='OPEN'>Đang xử lý</option>
            <option value=''>Tất cả</option>
            {(Object.keys(CASE_STATUS) as CaseStatus[]).map((s) => (
              <option key={s} value={s}>
                {CASE_STATUS[s].label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className='grid gap-1.5 text-sm font-medium'>
          Thời hạn
          <NativeSelect value={sla} onChange={(e) => (setSla(e.target.value), setPage(0))} className='w-44'>
            <option value=''>Tất cả</option>
            <option value='overdue'>Quá hạn</option>
            <option value='soon'>Sắp quá hạn</option>
            <option value='paused'>Đang tạm dừng</option>
            <option value='not_started'>Chưa tính hạn</option>
          </NativeSelect>
        </label>
      </form>
      <div className='bg-card overflow-x-auto rounded-lg border'>
        {rows.length === 0 ? (
          <Empty>Không có phiếu phù hợp. Thử tìm bằng số điện thoại hoặc mã phiếu, hoặc chọn "Tất cả" trạng thái.</Empty>
        ) : (
          <CaseTable rows={pageRows} />
        )}
      </div>
      {pages > 1 && (
        <div className='flex items-center justify-end gap-2 text-sm'>
          <span className='text-muted-foreground'>
            Trang {page + 1}/{pages}
          </span>
          <Button variant='outline' size='sm' disabled={page === 0} onClick={() => setPage(page - 1)}>
            Trước
          </Button>
          <Button variant='outline' size='sm' disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
            Sau
          </Button>
        </div>
      )}
    </PageShell>
  )
}

export function CaseTable({ rows, hideCustomer }: { rows: WarrantyCase[]; hideCustomer?: boolean }) {
  const db = useDb()
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Phiếu</TableHead>
          {!hideCustomer && <TableHead>Khách hàng</TableHead>}
          <TableHead>Thiết bị</TableHead>
          <TableHead>Trạng thái</TableHead>
          <TableHead>Thời hạn</TableHead>
          <TableHead>Phụ trách</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((c) => {
          const cu = db.customers.find((x) => x.id === c.customerId)!
          const d = db.devices.find((x) => x.id === c.deviceId)!
          const wo = db.workOrders.find((w) => w.id === c.workOrderId)
          return (
            <TableRow key={c.id}>
              <TableCell>
                <CaseLink c={c} />
                <div className='text-muted-foreground text-xs'>
                  {c.channel === 'ONLINE' ? 'Trực tuyến' : 'Tại quầy'}, {fmtDateTime(c.receivedAt ?? c.createdAt)}
                </div>
              </TableCell>
              {!hideCustomer && (
                <TableCell className='min-w-36 whitespace-normal'>
                  {cu.name}
                  <div className='text-muted-foreground text-xs'>{cu.phone}</div>
                </TableCell>
              )}
              <TableCell className='min-w-44 whitespace-normal'>
                <span className='flex items-center gap-2'>
                  <DeviceIcon kind={d.kind} className='size-6' />
                  <span>
                    {d.brand} {d.model}
                  </span>
                </span>
              </TableCell>
              <TableCell>
                <StatusBadge status={c.status} />
              </TableCell>
              <TableCell>
                <SlaBadge c={c} />
              </TableCell>
              <TableCell>
                <UserChip id={wo?.technicianId ?? c.diagnosisTechId} />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
