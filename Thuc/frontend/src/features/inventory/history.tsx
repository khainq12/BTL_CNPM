import { useState } from 'react'
import { useDb } from '@/api/hooks'
import { fmtDateTime } from '@/domain/format'
import type { StockMoveType } from '@/domain/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { NativeSelect } from '@/components/form-kit'
import { Empty, Guard, PageShell, Pill, useName } from '@/components/woms'

const LABEL: Record<StockMoveType, string> = { NHAP: 'Nhập kho', GIU: 'Giữ cho lệnh', BO_GIU: 'Bỏ giữ', XUAT: 'Cấp phát', TRA: 'Nhận lại', DIEU_CHINH: 'Điều chỉnh' }

// S-64 Lịch sử biến động kho.
export function StockHistory() {
  return (
    <Guard page='stockHistory'>
      <Inner />
    </Guard>
  )
}

function Inner() {
  const db = useDb()
  const name = useName()
  const [type, setType] = useState('')
  const rows = db.stockMoves.filter((m) => !type || m.type === type)
  return (
    <PageShell title='Lịch sử kho' description='Mọi lần nhập, giữ, cấp phát, nhận lại và điều chỉnh đều được ghi, không sửa được.'>
      <label className='grid w-56 gap-1.5 text-sm font-medium'>
        Loại giao dịch
        <NativeSelect value={type} onChange={(e) => setType(e.target.value)}>
          <option value=''>Tất cả</option>
          {Object.entries(LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </NativeSelect>
      </label>
      <div className='bg-card overflow-x-auto rounded-lg border'>
        {rows.length === 0 ? (
          <Empty>Chưa có giao dịch.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thời điểm</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Linh kiện</TableHead>
                <TableHead className='text-right'>Số lượng</TableHead>
                <TableHead>Lệnh sửa</TableHead>
                <TableHead>Người thực hiện</TableHead>
                <TableHead>Ghi chú</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className='whitespace-nowrap'>{fmtDateTime(m.at)}</TableCell>
                  <TableCell>
                    <Pill tone={m.type === 'DIEU_CHINH' ? 'wait' : 'neutral'}>{LABEL[m.type]}</Pill>
                  </TableCell>
                  <TableCell>{db.parts.find((p) => p.id === m.partId)?.name}</TableCell>
                  <TableCell className='text-right tabular-nums'>{m.qty}</TableCell>
                  <TableCell>{m.woCode ?? '—'}</TableCell>
                  <TableCell>{name(m.by)}</TableCell>
                  <TableCell className='text-muted-foreground max-w-64 whitespace-normal'>{m.note ?? ''}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </PageShell>
  )
}
