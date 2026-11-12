import { useState } from 'react'
import { useAction, useDb, useMe } from '@/api/hooks'
import * as api from '@/api/service'
import type { WorkOrder } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { CancelButton, Field, FormDialog, SubmitButton } from '@/components/form-kit'
import { Pill } from '@/components/woms'

// Bảng linh kiện của một lệnh sửa chữa. Kho thao tác: giữ, báo thiếu, cấp phát, nhận lại (BR-14..16).
export function WoParts({ wo, compact }: { wo: WorkOrder; compact?: boolean }) {
  const me = useMe()
  const db = useDb()
  const c = db.cases.find((x) => x.id === wo.caseId)!
  const isKho = me.role === 'KHO'
  const reserve = useAction(api.reserveParts, { success: 'Đã giữ linh kiện' })
  const issue = useAction(api.issueParts, { success: 'Đã cấp phát linh kiện' })
  const ret = useAction(api.confirmPartReturn, { success: 'Đã nhận lại linh kiện' })
  const [shortOpen, setShortOpen] = useState(false)

  if (wo.parts.length === 0) return <p className='text-muted-foreground text-sm'>Lệnh sửa chữa không cần linh kiện.</p>
  const needReserve = wo.parts.some((p) => p.reserved + p.issued < p.qty)
  const canReserve = needReserve && wo.parts.some((p) => p.reserved + p.issued < p.qty && db.parts.find((x) => x.id === p.partId)!.onHand - db.parts.find((x) => x.id === p.partId)!.reserved > 0)
  const canIssue = wo.parts.some((p) => p.reserved > 0)

  return (
    <div className='grid gap-3'>
      <div className='overflow-x-auto rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Linh kiện</TableHead>
              <TableHead className='text-right'>Cần</TableHead>
              <TableHead className='text-right'>Đã giữ</TableHead>
              <TableHead className='text-right'>Đã cấp</TableHead>
              {!compact && <TableHead className='text-right'>Đã dùng</TableHead>}
              <TableHead className='text-right'>Khả dụng</TableHead>
              <TableHead>Tình trạng</TableHead>
              {isKho && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {wo.parts.map((p) => {
              const part = db.parts.find((x) => x.id === p.partId)!
              const avail = part.onHand - part.reserved
              const ok = p.reserved + p.issued >= p.qty
              return (
                <TableRow key={p.partId}>
                  <TableCell>
                    <div className='font-medium'>{part.name}</div>
                    <div className='text-muted-foreground text-xs'>
                      {part.sku} · {part.location}
                    </div>
                  </TableCell>
                  <TableCell className='text-right tabular-nums'>{p.qty}</TableCell>
                  <TableCell className='text-right tabular-nums'>{p.reserved}</TableCell>
                  <TableCell className='text-right tabular-nums'>{p.issued}</TableCell>
                  {!compact && <TableCell className='text-right tabular-nums'>{p.used}</TableCell>}
                  <TableCell className='text-right tabular-nums'>{avail}</TableCell>
                  <TableCell>
                    {p.returnPending > 0 ? <Pill tone='wait'>Chờ trả kho {p.returnPending}</Pill> : p.issued >= p.qty ? <Pill tone='done'>Đã cấp đủ</Pill> : ok ? <Pill tone='info'>Đã giữ đủ</Pill> : <Pill tone={avail > 0 ? 'wait' : 'bad'}>{avail > 0 ? 'Chưa giữ' : 'Hết hàng'}</Pill>}
                  </TableCell>
                  {isKho && (
                    <TableCell className='text-right'>
                      {p.returnPending > 0 && (
                        <Button size='sm' variant='outline' disabled={ret.isPending} onClick={() => ret.mutate([me, wo.id, p.partId])}>
                          Nhận lại
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
      {isKho && (needReserve || canIssue) && !['COMPLETED', 'CANCELLED'].includes(c.status) && (
        <div className='flex flex-wrap gap-2'>
          {needReserve && (
            <Button size='sm' disabled={!canReserve || reserve.isPending} onClick={() => reserve.mutate([me, wo.id])}>
              Giữ linh kiện khả dụng
            </Button>
          )}
          {needReserve && c.status === 'WO_CREATED' && (
            <Button size='sm' variant='outline' onClick={() => setShortOpen(true)}>
              Báo thiếu linh kiện
            </Button>
          )}
          {canIssue && (
            <Button size='sm' variant={needReserve ? 'outline' : 'default'} disabled={issue.isPending} onClick={() => issue.mutate([me, wo.id])}>
              Cấp phát cho kỹ thuật viên
            </Button>
          )}
        </div>
      )}
      {shortOpen && <Shortage wo={wo} onClose={() => setShortOpen(false)} />}
    </div>
  )
}

function Shortage({ wo, onClose }: { wo: WorkOrder; onClose: () => void }) {
  const me = useMe()
  const [note, setNote] = useState('')
  const m = useAction(api.markShortage, { success: 'Đã báo thiếu, phiếu chuyển chờ linh kiện', onDone: onClose })
  return (
    <FormDialog
      open
      onOpenChange={onClose}
      title={`Báo thiếu linh kiện cho ${wo.code}`}
      description='Phiếu chuyển "Chờ linh kiện", thời hạn tạm dừng tối đa 3 ngày làm việc (PARAM-17). Hệ thống tạo đề nghị mua gửi quản lý (BR-17).'
      onSubmit={() => m.mutate([me, wo.id, note])}
      footer={
        <>
          <CancelButton onClick={onClose} />
          <SubmitButton type='submit' pending={m.isPending}>Báo thiếu</SubmitButton>
        </>
      }
    >
      <Field label='Ghi chú (nhà cung cấp, ngày dự kiến về)'>{(id) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
    </FormDialog>
  )
}
