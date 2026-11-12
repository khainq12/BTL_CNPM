import { useState } from 'react'
import { useAction, useDb, useMe } from '@/api/hooks'
import * as api from '@/api/service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { CancelButton, Field, FormDialog, SubmitButton } from '@/components/form-kit'
import { Guard, PageShell, Pill } from '@/components/woms'

// S-63 Kiểm kê: nhập số đếm thực tế; chênh lệch phải gửi quản lý duyệt, không tự sửa tồn (BR-18).
export function Stocktake() {
  return (
    <Guard page='stocktake'>
      <Inner />
    </Guard>
  )
}

function Inner() {
  const db = useDb()
  const me = useMe()
  const [counted, setCounted] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const m = useAction(api.requestAdjust, { success: 'Đã gửi đề nghị điều chỉnh cho quản lý', onDone: () => (setOpen(null), setReason(''), setTried(false)) })
  const pending = (pid: string) => db.approvals.some((a) => a.type === 'DIEU_CHINH_KHO' && a.partId === pid && a.status === 'CHO_DUYET')
  const part = db.parts.find((p) => p.id === open)

  return (
    <PageShell title='Kiểm kê' description='Nhập số lượng đếm được. Dòng có chênh lệch cần ghi nguyên nhân và gửi quản lý duyệt trước khi điều chỉnh.'>
      <div className='overflow-x-auto rounded-lg border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Linh kiện</TableHead>
              <TableHead>Vị trí</TableHead>
              <TableHead className='text-right'>Trên hệ thống</TableHead>
              <TableHead className='w-36'>Đếm thực tế</TableHead>
              <TableHead className='text-right'>Chênh lệch</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {db.parts.map((p) => {
              const v = counted[p.id]
              const diff = v === undefined || v === '' ? null : Number(v) - p.onHand
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className='font-medium'>{p.name}</div>
                    <div className='text-muted-foreground font-mono text-xs'>{p.sku}</div>
                  </TableCell>
                  <TableCell>{p.location}</TableCell>
                  <TableCell className='text-right tabular-nums'>{p.onHand}</TableCell>
                  <TableCell>
                    <Input aria-label={`Số đếm ${p.name}`} type='number' min={0} value={v ?? ''} onChange={(e) => setCounted({ ...counted, [p.id]: e.target.value })} />
                  </TableCell>
                  <TableCell className='text-right tabular-nums'>{diff === null ? '—' : diff === 0 ? 'Khớp' : <span className='font-medium text-red-700 dark:text-red-400'>{diff > 0 ? `+${diff}` : diff}</span>}</TableCell>
                  <TableCell className='text-right'>
                    {pending(p.id) ? (
                      <Pill tone='wait'>Chờ duyệt</Pill>
                    ) : (
                      diff !== null &&
                      diff !== 0 &&
                      me.role === 'KHO' && (
                        <Button size='sm' variant='outline' onClick={() => setOpen(p.id)}>
                          Đề nghị điều chỉnh
                        </Button>
                      )
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      {part && (
        <FormDialog
          open
          onOpenChange={() => setOpen(null)}
          title={`Điều chỉnh ${part.name}`}
          description={`Hệ thống: ${part.onHand}, đếm được: ${counted[part.id]}. Kiểm tra lại lịch sử nhập xuất trước khi gửi.`}
          onSubmit={() => {
            setTried(true)
            if (reason.trim()) m.mutate([me, part.id, Number(counted[part.id]), reason])
          }}
          footer={
            <>
              <CancelButton onClick={() => setOpen(null)} />
              <SubmitButton type='submit' pending={m.isPending}>Gửi quản lý duyệt</SubmitButton>
            </>
          }
        >
          <Field label='Nguyên nhân chênh lệch' required error={tried && !reason.trim() && 'Ghi nguyên nhân (BR-18).'}>
            {(id) => <Textarea id={id} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />}
          </Field>
        </FormDialog>
      )}
    </PageShell>
  )
}
