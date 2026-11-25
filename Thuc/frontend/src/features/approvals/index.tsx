import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useAction, useDb, useMe } from '@/api/hooks'
import * as api from '@/api/service'
import { approvalStatus } from '@/domain/approvals'
import { fmtDateTime, fmtMoney } from '@/domain/format'
import type { Approval, ApprovalType } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { CancelButton, Field, FormDialog, SubmitButton } from '@/components/form-kit'
import { Empty, Guard, PageShell, Pill, useName } from '@/components/woms'

const TYPE: Record<ApprovalType, string> = {
  NGOAI_LE_BH: 'Ngoại lệ bảo hành',
  BAO_GIA: 'Báo giá vượt ngưỡng',
  MUA_LINH_KIEN: 'Mua linh kiện',
  DIEU_CHINH_KHO: 'Điều chỉnh tồn kho',
  HUY_HO_SO: 'Hủy phiếu',
  XEM_XET_QC: 'Không đạt QC sau 2 lần sửa',
}

// S-32 Phê duyệt của quản lý (StRS-25, BR-07, BR-17, BR-18, BR-22, BR-30).
export function Approvals() {
  return (
    <Guard page='approvals'>
      <Inner />
    </Guard>
  )
}

function Inner() {
  const db = useDb()
  const [open, setOpen] = useState<Approval | null>(null)
  const pending = db.approvals.filter((a) => a.status === 'CHO_DUYET').sort((a, b) => a.requestedAt.localeCompare(b.requestedAt))
  const done = db.approvals.filter((a) => a.status !== 'CHO_DUYET').sort((a, b) => (b.decidedAt ?? '').localeCompare(a.decidedAt ?? ''))
  return (
    <PageShell title='Phê duyệt' description='Các đề nghị vượt quyền hạn của nhân viên. Mọi quyết định được ghi vào nhật ký.'>
      <Tabs defaultValue='pending'>
        <TabsList>
          <TabsTrigger value='pending'>Chờ duyệt ({pending.length})</TabsTrigger>
          <TabsTrigger value='done'>Đã xử lý ({done.length})</TabsTrigger>
        </TabsList>
        <TabsContent value='pending' className='mt-4'>
          <ApprovalList rows={pending} onOpen={setOpen} />
        </TabsContent>
        <TabsContent value='done' className='mt-4'>
          <ApprovalList rows={done} />
        </TabsContent>
      </Tabs>
      {open && <Decide a={open} onClose={() => setOpen(null)} />}
    </PageShell>
  )
}

function ApprovalList({ rows, onOpen }: { rows: Approval[]; onOpen?: (a: Approval) => void }) {
  const name = useName()
  const db = useDb()
  if (!rows.length) return <Empty className='bg-card rounded-lg border'>Không có đề nghị.</Empty>
  return (
    <ul className='bg-card divide-y rounded-lg border'>
      {rows.map((a) => {
        const c = db.cases.find((x) => x.id === a.caseId)
        return (
          <li key={a.id} className='flex flex-wrap items-start gap-x-4 gap-y-2 p-4 text-sm'>
            <div className='min-w-64 flex-1'>
              <div className='flex flex-wrap items-center gap-2'>
                <Pill tone='info'>{TYPE[a.type]}</Pill>
                {c && (
                  <Link to='/phieu/$id' params={{ id: c.id }} className='font-medium underline-offset-4 hover:underline'>
                    {c.code}
                  </Link>
                )}
              </div>
              <p className='mt-1 font-medium'>{a.title}</p>
              <p className='text-muted-foreground'>{a.detail}</p>
              <p className='text-muted-foreground mt-1 text-xs'>
                {name(a.requestedBy)} đề nghị lúc {fmtDateTime(a.requestedAt)}
                {a.decidedAt && a.status !== 'CHO_DUYET' && ` · ${a.status === 'DA_HUY' ? 'Tự hủy' : `${a.status === 'DA_DUYET' ? 'Duyệt' : 'Từ chối'} bởi ${name(a.decidedBy)}`} lúc ${fmtDateTime(a.decidedAt)}${a.decisionNote ? `: ${a.decisionNote}` : ''}`}
              </p>
            </div>
            {onOpen ? (
              <Button size='sm' onClick={() => onOpen(a)}>
                Xem xét
              </Button>
            ) : (
              <Pill tone={approvalStatus(a).tone}>{approvalStatus(a).label}</Pill>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function Decide({ a, onClose }: { a: Approval; onClose: () => void }) {
  const me = useMe()
  const db = useDb()
  const [choice, setChoice] = useState<'yes' | 'no' | 'SUA_TIEP' | 'TRA_MAY'>(a.type === 'XEM_XET_QC' ? 'SUA_TIEP' : 'yes')
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)
  const m = useAction(api.decideApproval, { success: 'Đã ghi quyết định', onDone: onClose })
  const c = db.cases.find((x) => x.id === a.caseId)
  const q = c?.quotes.at(-1)
  const reject = choice === 'no'
  return (
    <FormDialog
      open
      onOpenChange={onClose}
      wide
      title={a.title}
      description={TYPE[a.type]}
      onSubmit={() => {
        setTried(true)
        if (reject && !note.trim()) return
        const option = choice === 'SUA_TIEP' || choice === 'TRA_MAY' ? choice : undefined
        m.mutate([me, a.id, { approve: !reject, note, option }])
      }}
      footer={
        <>
          <CancelButton onClick={onClose} />
          <SubmitButton type='submit' pending={m.isPending} variant={reject ? 'destructive' : 'default'}>
            {reject ? 'Từ chối' : 'Xác nhận quyết định'}
          </SubmitButton>
        </>
      }
    >
      <p className='text-sm'>{a.detail}</p>
      {a.type === 'BAO_GIA' && q && (
        <div className='bg-muted rounded-md p-3 text-sm'>
          {q.items.map((i, k) => (
            <p key={k}>
              {i.label}: {i.qty} × {fmtMoney(i.unitPrice)}
            </p>
          ))}
          <p>Tiền công: {fmtMoney(q.labor)}</p>
          <p className='font-semibold'>Tổng: {fmtMoney(q.total)}</p>
        </div>
      )}
      {a.type === 'XEM_XET_QC' && c && (
        <div className='bg-muted rounded-md p-3 text-sm'>
          {c.qc.map((r) => (
            <p key={r.round}>
              Lần {r.round}: {r.pass ? 'Đạt' : `Không đạt. ${r.defect}`}
            </p>
          ))}
        </div>
      )}
      <RadioGroup value={choice} onValueChange={(v) => setChoice(v as typeof choice)} className='gap-2'>
        {(a.type === 'XEM_XET_QC'
          ? [
              ['SUA_TIEP', 'Cho sửa tiếp (ghi rõ chỉ đạo)'],
              ['TRA_MAY', 'Dừng sửa, trả thiết bị cho khách'],
            ]
          : [
              ['yes', 'Duyệt'],
              ['no', 'Từ chối'],
            ]
        ).map(([v, l]) => (
          <label key={v} className='has-[[data-state=checked]]:border-primary flex items-center gap-2 rounded-md border p-3 text-sm'>
            <RadioGroupItem value={v} /> {l}
          </label>
        ))}
      </RadioGroup>
      <Field label={reject ? 'Lý do từ chối' : 'Ghi chú quyết định'} required={reject} error={tried && reject && !note.trim() && 'Ghi lý do khi từ chối.'}>
        {(id) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}
      </Field>
      {a.type === 'XEM_XET_QC' && <p className='text-muted-foreground text-xs'>Không tự động đổi máy (C13). Nếu đổi máy theo chính sách, ghi trong chỉ đạo.</p>}
    </FormDialog>
  )
}
