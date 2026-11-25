import { useState } from 'react'
import { useDb } from '@/api/hooks'
import { fmtDateTime } from '@/domain/format'
import type { AuditEntry } from '@/domain/types'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { NativeSelect } from '@/components/form-kit'
import { Empty, Guard, PageShell, useName } from '@/components/woms'

const ENTITY: Record<AuditEntry['entity'], string> = { PHIEU: 'Phiếu', WO: 'Lệnh sửa chữa', KHO: 'Kho', PHE_DUYET: 'Phê duyệt', TAI_KHOAN: 'Tài khoản', KHIEU_NAI: 'Khiếu nại', PHIEN: 'Đăng nhập', CAU_HINH: 'Cấu hình' }

// Nhật ký thao tác (BR-28, NFR-02): chỉ đọc, không ai sửa được.
export function AuditLog() {
  return (
    <Guard page='audit'>
      <Inner />
    </Guard>
  )
}

function Inner() {
  const db = useDb()
  const name = useName()
  const [entity, setEntity] = useState('')
  const [user, setUser] = useState('')
  const [q, setQ] = useState('')
  const rows = db.audit.filter((a) => (!entity || a.entity === entity) && (!user || a.by === user) && (!q || `${a.ref} ${a.action} ${a.detail ?? ''}`.toLowerCase().includes(q.toLowerCase()))).slice(0, 300)
  return (
    <PageShell title='Nhật ký thao tác' description='Ghi mọi thao tác thay đổi dữ liệu: ai, lúc nào, làm gì. Không sửa, không xóa được.'>
      <div className='flex flex-wrap items-end gap-3'>
        <label className='grid min-w-56 flex-1 gap-1.5 text-sm font-medium'>
          Tìm
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder='Mã phiếu, mã WO, nội dung' />
        </label>
        <label className='grid gap-1.5 text-sm font-medium'>
          Đối tượng
          <NativeSelect value={entity} onChange={(e) => setEntity(e.target.value)} className='w-44'>
            <option value=''>Tất cả</option>
            {Object.entries(ENTITY).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className='grid gap-1.5 text-sm font-medium'>
          Người thực hiện
          <NativeSelect value={user} onChange={(e) => setUser(e.target.value)} className='w-48'>
            <option value=''>Tất cả</option>
            {db.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </NativeSelect>
        </label>
      </div>
      <div className='bg-card overflow-x-auto rounded-lg border'>
        {rows.length === 0 ? (
          <Empty>Chưa có thao tác nào khớp bộ lọc. Nhật ký bắt đầu ghi từ khi khôi phục dữ liệu mẫu.</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thời điểm</TableHead>
                <TableHead>Người thực hiện</TableHead>
                <TableHead>Đối tượng</TableHead>
                <TableHead>Mã</TableHead>
                <TableHead>Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className='whitespace-nowrap'>{fmtDateTime(a.at)}</TableCell>
                  <TableCell>{name(a.by)}</TableCell>
                  <TableCell>{ENTITY[a.entity]}</TableCell>
                  <TableCell className='font-mono text-xs'>{a.ref}</TableCell>
                  <TableCell className='max-w-96 whitespace-normal'>
                    {a.action}
                    {a.detail && <div className='text-muted-foreground text-xs'>{a.detail}</div>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </PageShell>
  )
}
