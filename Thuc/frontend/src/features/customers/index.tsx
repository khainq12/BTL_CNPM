import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useDb } from '@/api/hooks'
import { OPEN_STATUSES } from '@/domain/statuses'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Empty, Guard, PageShell } from '@/components/woms'

// S-10/S-11: tìm khách theo SĐT hoặc tên (BR-11: không tìm bằng serial).
export function Customers() {
  return (
    <Guard page='customers'>
      <Inner />
    </Guard>
  )
}

function Inner() {
  const db = useDb()
  const [q, setQ] = useState('')
  const term = q.trim().toLowerCase()
  const rows = db.customers.filter((c) => !term || c.phone.includes(term.replace(/\s/g, '')) || c.name.toLowerCase().includes(term))
  return (
    <PageShell title='Khách hàng' description='Tìm theo số điện thoại hoặc họ tên.'>
      <label className='grid max-w-md gap-1.5 text-sm font-medium'>
        Tìm khách
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder='0912345678 hoặc Nguyễn Thị Mai' />
      </label>
      <div className='bg-card overflow-x-auto rounded-lg border'>
        {rows.length === 0 ? (
          <Empty>Không tìm thấy khách. Khách mới được tạo hồ sơ khi lập phiếu tiếp nhận.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Họ tên</TableHead>
                <TableHead>Điện thoại</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className='text-right'>Thiết bị</TableHead>
                <TableHead className='text-right'>Phiếu đang mở</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link to='/khach-hang/$id' params={{ id: c.id }} className='font-medium underline-offset-4 hover:underline'>
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell>{c.phone}</TableCell>
                  <TableCell>{c.email ?? '—'}</TableCell>
                  <TableCell className='text-right tabular-nums'>{db.devices.filter((d) => d.customerId === c.id).length}</TableCell>
                  <TableCell className='text-right tabular-nums'>{db.cases.filter((k) => k.customerId === c.id && OPEN_STATUSES.includes(k.status)).length}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </PageShell>
  )
}
