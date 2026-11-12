import { useState } from 'react'
import { useDb } from '@/api/hooks'
import { fmtMoney } from '@/domain/format'
import { PARAMS } from '@/domain/params'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Empty, Guard, PageShell, Pill } from '@/components/woms'

// S-60 Tồn kho: tách tồn thực tế, đã giữ, khả dụng (C11).
export function Stock() {
  return (
    <Guard page='inventory'>
      <Inner />
    </Guard>
  )
}

function Inner() {
  const db = useDb()
  const [q, setQ] = useState('')
  const term = q.trim().toLowerCase()
  const rows = db.parts.filter((p) => !term || p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term) || p.fits.toLowerCase().includes(term))
  return (
    <PageShell title='Tồn kho linh kiện' description={`Khả dụng = tồn thực tế − đã giữ. Dưới ${PARAMS.minStock} đơn vị thì cảnh báo bổ sung (PARAM-06).`}>
      <label className='grid max-w-md gap-1.5 text-sm font-medium'>
        Tìm linh kiện
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder='Mã, tên hoặc model phù hợp' />
      </label>
      <div className='overflow-x-auto rounded-lg border'>
        {rows.length === 0 ? (
          <Empty>Không tìm thấy linh kiện.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã</TableHead>
                <TableHead>Linh kiện</TableHead>
                <TableHead>Phù hợp</TableHead>
                <TableHead>Vị trí</TableHead>
                <TableHead className='text-right'>Tồn thực tế</TableHead>
                <TableHead className='text-right'>Đã giữ</TableHead>
                <TableHead className='text-right'>Khả dụng</TableHead>
                <TableHead className='text-right'>Đơn giá</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => {
                const avail = p.onHand - p.reserved
                return (
                  <TableRow key={p.id}>
                    <TableCell className='font-mono text-xs'>{p.sku}</TableCell>
                    <TableCell className='font-medium'>{p.name}</TableCell>
                    <TableCell className='text-muted-foreground'>{p.fits}</TableCell>
                    <TableCell>{p.location}</TableCell>
                    <TableCell className='text-right tabular-nums'>{p.onHand}</TableCell>
                    <TableCell className='text-right tabular-nums'>{p.reserved}</TableCell>
                    <TableCell className='text-right'>
                      <span className='inline-flex items-center gap-2 tabular-nums'>
                        {avail < PARAMS.minStock && <Pill tone={avail === 0 ? 'bad' : 'wait'}>{avail === 0 ? 'Hết' : 'Thấp'}</Pill>}
                        {avail}
                      </span>
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>{fmtMoney(p.price)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </PageShell>
  )
}
