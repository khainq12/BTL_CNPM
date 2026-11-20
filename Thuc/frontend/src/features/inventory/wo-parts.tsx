import { useState } from 'react'
import { useAction, useDb, useMe } from '@/api/hooks'
import * as api from '@/api/service'
import { availableQty, missingQty, onOrderQty, toOrderQty } from '@/domain/parts'
import { slaInfo, waitingForParts } from '@/domain/sla'
import type { CaseStatus, WorkOrder } from '@/domain/types'
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
  const needReserve = wo.parts.some((p) => missingQty(p) > 0)
  const canReserve = wo.parts.some((p) => missingQty(p) > 0 && availableQty(db, p.partId) > 0)
  const canIssue = wo.parts.some((p) => p.reserved > 0)
  // Báo thiếu phần không có sẵn trong kho và chưa có đề nghị mua đang chờ (cùng quy tắc với lớp API).
  const canReportShort = ['WO_CREATED', 'WAITING_PARTS', 'IN_REPAIR'].includes(c.status) && wo.parts.some((p) => toOrderQty(db, wo, p) > 0)
  const hasOnOrder = wo.parts.some((p) => missingQty(p) > 0 && onOrderQty(db, wo.id, p.partId) > 0)
  const waitingNote =
    waitingForParts(c) && hasOnOrder ? `Phần thiếu đã có đề nghị mua, đang chờ hàng về.${slaInfo(c).kind === 'paused' ? ' Thời hạn xử lý tạm dừng.' : ''}` : undefined

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
              const ok = missingQty(p) === 0
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
                    {p.returnPending > 0 ? (
                      <Pill tone='wait'>Chờ trả kho {p.returnPending}</Pill>
                    ) : p.issued >= p.qty ? (
                      <Pill tone='done'>Đã cấp đủ</Pill>
                    ) : ok ? (
                      <Pill tone='info'>Đã giữ đủ</Pill>
                    ) : avail <= 0 && onOrderQty(db, wo.id, p.partId) > 0 ? (
                      <Pill tone='wait'>Đã đề nghị mua</Pill>
                    ) : (
                      <Pill tone={avail > 0 ? 'wait' : 'bad'}>{avail > 0 ? 'Chưa giữ' : 'Hết hàng'}</Pill>
                    )}
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
          {canReportShort && (
            <Button size='sm' variant='outline' onClick={() => setShortOpen(true)}>
              Báo thiếu linh kiện
            </Button>
          )}
          {canIssue && (
            <Button size='sm' variant={needReserve ? 'outline' : 'default'} disabled={issue.isPending || !wo.technicianId} onClick={() => issue.mutate([me, wo.id])}>
              Cấp phát cho kỹ thuật viên
            </Button>
          )}
          {canIssue && !wo.technicianId && <p className='text-muted-foreground self-center text-xs'>Chờ điều phối phân công kỹ thuật viên rồi mới cấp phát (BR-15).</p>}
          {waitingNote && <p className='text-muted-foreground self-center text-xs'>{waitingNote}</p>}
        </div>
      )}
      {shortOpen && <Shortage wo={wo} status={c.status} onClose={() => setShortOpen(false)} />}
    </div>
  )
}

function Shortage({ wo, status, onClose }: { wo: WorkOrder; status: CaseStatus; onClose: () => void }) {
  const me = useMe()
  const db = useDb()
  const [note, setNote] = useState('')
  const moves = status === 'WO_CREATED'
  const m = useAction(api.markShortage, { success: moves ? 'Đã báo thiếu, phiếu chuyển chờ linh kiện' : 'Đã báo thiếu, đã gửi đề nghị mua cho quản lý', onDone: onClose })
  const lines = wo.parts.map((l) => ({ l, qty: toOrderQty(db, wo, l) })).filter((x) => x.qty > 0)
  const where = moves ? 'Phiếu chuyển "Chờ linh kiện"' : status === 'IN_REPAIR' ? 'Phiếu vẫn "Đang sửa" theo phương án mới' : 'Phiếu vẫn "Chờ linh kiện"'
  return (
    <FormDialog
      open
      onOpenChange={onClose}
      title={`Báo thiếu linh kiện cho ${wo.code}`}
      description={`${where}. Chỉ đề nghị mua phần không có sẵn trong kho và chưa có đề nghị (BR-17); thời hạn tạm dừng tối đa 3 ngày làm việc (PARAM-17).`}
      onSubmit={() => m.mutate([me, wo.id, note])}
      footer={
        <>
          <CancelButton onClick={onClose} />
          <SubmitButton type='submit' pending={m.isPending}>Báo thiếu</SubmitButton>
        </>
      }
    >
      <p className='text-sm'>
        Sẽ đề nghị mua: {lines.map(({ l, qty }) => `${db.parts.find((x) => x.id === l.partId)?.name} × ${qty}`).join('; ') || 'không còn phần nào'}
      </p>
      <Field label='Ghi chú (nhà cung cấp, ngày dự kiến về)'>{(id) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
    </FormDialog>
  )
}
