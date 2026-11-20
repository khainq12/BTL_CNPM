import { useState } from 'react'
import { useAction, useDb, useMe } from '@/api/hooks'
import * as api from '@/api/service'
import { currentPlan, openChange } from '@/domain/plan-change'
import { fmtDateTime, fmtMinutes, fmtMoney } from '@/domain/format'
import { PARAMS } from '@/domain/params'
import { CONFIRM_METHODS } from '@/domain/rules'
import type { PlanChange, WarrantyCase, WorkOrder } from '@/domain/types'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { CancelButton, Field, FormDialog, FormSheet, NativeSelect, SubmitButton } from '@/components/form-kit'
import { InfoList, Pill, Section, useName } from '@/components/woms'
import { PartRows, QuoteBuilder, TaskRows, quoteTotal, type PartRow, type QuoteItem, type TaskRow } from './editors'

// Đổi phương án khi đang sửa (BR-12): KTV đề xuất → CSKH xét lại bảo hành/báo giá → (quản lý duyệt nếu vượt ngưỡng)
// → khách xác nhận lại. Trong lúc chờ, KTV tạm ngừng công việc.

type P = { c: WarrantyCase; wo?: WorkOrder; onClose: () => void }

export const CHANGE_STATUS: Record<PlanChange['status'], [string, 'wait' | 'info' | 'done' | 'bad']> = {
  CHO_CSKH: ['Chờ CSKH xét', 'wait'],
  CHO_DUYET: ['Chờ quản lý duyệt báo giá', 'wait'],
  CHO_GUI: ['Chờ gửi báo giá bổ sung', 'info'],
  CHO_KHACH: ['Chờ khách xác nhận', 'wait'],
  DA_AP_DUNG: ['Đã áp dụng', 'done'],
  TU_CHOI: ['Không áp dụng', 'bad'],
}

function ChangeSummary({ ch }: { ch: PlanChange }) {
  const db = useDb()
  const name = useName()
  return (
    <InfoList
      rows={[
        ['Lỗi mới phát hiện', ch.finding],
        ['Phương án cũ', ch.oldPlan || '—'],
        ['Phương án mới', ch.newPlan],
        ['Công việc thêm', ch.addTasks.map((t) => `${t.title} (${fmtMinutes(t.minutes)})`).join('; ') || 'Không'],
        ['Linh kiện thêm', ch.addParts.map((p) => `${db.parts.find((x) => x.id === p.partId)?.name} × ${p.qty}`).join('; ') || 'Không'],
        ['Tiền công ước tính', ch.extraLabor ? fmtMoney(ch.extraLabor) : '—'],
        ['Đề xuất', `${name(ch.proposedBy)} · ${fmtDateTime(ch.proposedAt)}`],
      ]}
    />
  )
}

export function PlanChangeList({ c }: { c: WarrantyCase }) {
  const name = useName()
  if (!c.planChanges?.length) return null
  return (
    <>
      {c.planChanges
        .slice()
        .reverse()
        .map((ch) => (
          <Section key={ch.id} title={`Đề xuất đổi phương án #${ch.no}`} actions={<Pill tone={CHANGE_STATUS[ch.status][1]}>{CHANGE_STATUS[ch.status][0]}</Pill>}>
            <ChangeSummary ch={ch} />
            {(ch.reviewNote || ch.outcome) && (
              <div className='mt-3 grid gap-1 border-t pt-3 text-sm'>
                {ch.reviewNote && (
                  <p>
                    CSKH: {ch.charge === 'MIEN_PHI' ? 'trong phạm vi bảo hành. ' : ch.charge === 'CO_PHI' ? `báo giá bổ sung v${ch.quoteVersion}. ` : ''}
                    {ch.reviewNote} <span className='text-muted-foreground text-xs'>· {name(ch.reviewedBy)}</span>
                  </p>
                )}
                {ch.outcome && <p className='font-medium'>{ch.outcome}</p>}
              </div>
            )}
          </Section>
        ))}
    </>
  )
}

function Propose({ c, onClose }: P) {
  const me = useMe()
  const [finding, setFinding] = useState('')
  const [plan, setPlan] = useState('')
  const [tasks, setTasks] = useState<TaskRow[]>([{ title: '', minutes: 30 }])
  const [parts, setParts] = useState<PartRow[]>([])
  const [labor, setLabor] = useState(0)
  const [tried, setTried] = useState(false)
  const m = useAction(api.proposePlanChange, { success: 'Đã gửi đề xuất cho CSKH', onDone: onClose })
  const validTasks = tasks.filter((t) => t.title.trim())
  const validParts = parts.filter((p) => p.partId)
  const errs = {
    finding: !finding.trim() && 'Ghi lỗi mới phát hiện.',
    plan: !plan.trim() && 'Ghi phương án đề xuất.',
    work: validTasks.length + validParts.length === 0 && 'Thêm ít nhất 1 công việc hoặc linh kiện bổ sung.',
  }
  return (
    <FormSheet
      open
      onOpenChange={onClose}
      title='Đề xuất đổi phương án sửa chữa'
      description='Dùng khi phát hiện lỗi mới hoặc phương án đã xác nhận không còn phù hợp (BR-12). Công việc tạm ngừng cho tới khi CSKH, và khách nếu phát sinh phí, xác nhận lại.'
      onSubmit={() => {
        setTried(true)
        if (Object.values(errs).some(Boolean)) return
        m.mutate([me, c.id, c.version, { finding, newPlan: plan, addTasks: validTasks, addParts: validParts, extraLabor: labor }])
      }}
      footer={
        <>
          <CancelButton onClick={onClose} />
          <SubmitButton type='submit' pending={m.isPending}>Gửi đề xuất</SubmitButton>
        </>
      }
    >
      <p className='bg-muted rounded-md p-3 text-sm'>
        <span className='font-medium'>Phương án hiện hành:</span> {currentPlan(c) || '—'}
      </p>
      <Field label='Lỗi mới phát hiện' required error={tried && errs.finding}>
        {(id) => <Textarea id={id} rows={2} value={finding} onChange={(e) => setFinding(e.target.value)} placeholder='Khi thay bàn phím phát hiện cáp màn hình bị đứt một phần' />}
      </Field>
      <Field label='Phương án đề xuất' required error={tried && errs.plan}>
        {(id) => <Textarea id={id} rows={2} value={plan} onChange={(e) => setPlan(e.target.value)} />}
      </Field>
      <TaskRows label='Công việc bổ sung' value={tasks} onChange={setTasks} placeholder='Thay cáp màn hình' error={tried && errs.work} />
      <PartRows label='Linh kiện bổ sung' value={parts} onChange={setParts} />
      <Field label='Tiền công phát sinh ước tính' hint='Để 0 nếu không phát sinh. CSKH dùng để lập báo giá bổ sung.'>
        {(id) => <Input id={id} type='number' min={0} step={10000} value={labor} onChange={(e) => setLabor(Number(e.target.value))} className='w-48' />}
      </Field>
    </FormSheet>
  )
}

function Review({ c, onClose }: P) {
  const me = useMe()
  const db = useDb()
  const ch = openChange(c)!
  const [result, setResult] = useState<'MIEN_PHI' | 'CO_PHI' | 'KHONG_DONG_Y'>(c.eligibility?.decision === 'MIEN_PHI' ? 'MIEN_PHI' : 'CO_PHI')
  const [note, setNote] = useState('')
  const [items, setItems] = useState<QuoteItem[]>(() =>
    ch.addParts.map((p) => {
      const part = db.parts.find((x) => x.id === p.partId)!
      return { label: part.name, qty: p.qty, unitPrice: part.price }
    })
  )
  const [labor, setLabor] = useState(ch.extraLabor)
  const [tried, setTried] = useState(false)
  const m = useAction(api.reviewPlanChange, { success: 'Đã lưu kết quả xét đổi phương án', onDone: onClose })
  const total = quoteTotal(items, labor)
  const rejected = c.quotes.find((q) => q.version === ch.quoteVersion)?.status === 'TU_CHOI_DUYET'
  return (
    <FormSheet
      open
      onOpenChange={onClose}
      title={`Xét đề xuất đổi phương án #${ch.no}`}
      description='Kiểm tra lại điều kiện bảo hành và chi phí của phương án mới trước khi kỹ thuật viên làm tiếp (BR-12).'
      onSubmit={() => {
        setTried(true)
        if (!note.trim()) return
        m.mutate([me, c.id, c.version, { result, note, quote: result === 'CO_PHI' ? { items, labor } : undefined }])
      }}
      footer={
        <>
          <CancelButton onClick={onClose} />
          <SubmitButton type='submit' pending={m.isPending}>
            {result === 'CO_PHI' ? (total > PARAMS.quoteApprovalThreshold ? 'Gửi quản lý duyệt báo giá' : 'Lưu và gửi báo giá bổ sung') : 'Lưu kết luận'}
          </SubmitButton>
        </>
      }
    >
      <ChangeSummary ch={ch} />
      {rejected && <p className='text-sm font-medium'>Quản lý đã từ chối báo giá bổ sung trước. Lập lại báo giá hoặc chọn hướng khác.</p>}
      <RadioGroup value={result} onValueChange={(v) => setResult(v as typeof result)} className='gap-2'>
        {(
          [
            ['MIEN_PHI', 'Trong phạm vi bảo hành, không thu thêm'],
            ['CO_PHI', 'Phát sinh phí, lập báo giá bổ sung'],
            ['KHONG_DONG_Y', 'Không chấp nhận, tiếp tục phương án cũ'],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className='has-[[data-state=checked]]:border-primary flex items-center gap-2 rounded-md border p-3 text-sm'>
            <RadioGroupItem value={k} />
            {label}
          </label>
        ))}
      </RadioGroup>
      <Field label='Căn cứ' required error={tried && !note.trim() && 'Ghi căn cứ kết luận.'}>
        {(id) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}
      </Field>
      {result === 'CO_PHI' && <QuoteBuilder title={`Báo giá bổ sung v${c.quotes.length + 1}`} items={items} onItems={setItems} labor={labor} onLabor={setLabor} />}
      {result === 'CO_PHI' && (
        <p className='text-muted-foreground text-sm'>Khi gửi báo giá cho khách, thời hạn xử lý tạm dừng tối đa {PARAMS.pauseQuoteMaxDays} ngày làm việc (PARAM-16).</p>
      )}
    </FormSheet>
  )
}

function SendQuote({ c, onClose }: P) {
  const me = useMe()
  const ch = openChange(c)!
  const q = c.quotes.find((x) => x.version === ch.quoteVersion)!
  const m = useAction(api.sendPlanChangeQuote, { success: 'Đã gửi báo giá bổ sung cho khách', onDone: onClose })
  return (
    <FormDialog
      open
      onOpenChange={onClose}
      title={`Gửi báo giá bổ sung v${q.version}`}
      description={`Quản lý đã duyệt. Từ lúc gửi, thời hạn xử lý tạm dừng tối đa ${PARAMS.pauseQuoteMaxDays} ngày làm việc (PARAM-16).`}
      onSubmit={() => m.mutate([me, c.id, c.version])}
      footer={
        <>
          <CancelButton onClick={onClose} />
          <SubmitButton type='submit' pending={m.isPending}>Gửi báo giá</SubmitButton>
        </>
      }
    >
      <p className='text-lg font-semibold tabular-nums'>{fmtMoney(q.total)}</p>
    </FormDialog>
  )
}

function Response({ c, onClose }: P) {
  const me = useMe()
  const ch = openChange(c)!
  const q = c.quotes.find((x) => x.version === ch.quoteVersion)!
  const [accepted, setAccepted] = useState<'yes' | 'no'>('yes')
  const [next, setNext] = useState<'TIEP_TUC' | 'TRA_MAY'>('TIEP_TUC')
  const [method, setMethod] = useState('')
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)
  const m = useAction(api.respondPlanChange, { success: 'Đã ghi nhận phản hồi của khách', onDone: onClose })
  return (
    <FormDialog
      open
      onOpenChange={onClose}
      title={`Phản hồi báo giá bổ sung v${q.version} · ${fmtMoney(q.total)}`}
      description='Khách đồng ý thì áp dụng phương án mới. Khách từ chối thì làm tiếp phương án cũ hoặc dừng sửa, trả thiết bị.'
      onSubmit={() => {
        setTried(true)
        if (method) m.mutate([me, c.id, c.version, { accepted: accepted === 'yes', method, note, next: accepted === 'no' ? next : undefined }])
      }}
      footer={
        <>
          <CancelButton onClick={onClose} />
          <SubmitButton type='submit' pending={m.isPending}>Lưu phản hồi</SubmitButton>
        </>
      }
    >
      <RadioGroup value={accepted} onValueChange={(v) => setAccepted(v as 'yes' | 'no')} className='grid-cols-2'>
        <label className='has-[[data-state=checked]]:border-primary flex items-center gap-2 rounded-md border p-3 text-sm'>
          <RadioGroupItem value='yes' /> Khách đồng ý
        </label>
        <label className='has-[[data-state=checked]]:border-primary flex items-center gap-2 rounded-md border p-3 text-sm'>
          <RadioGroupItem value='no' /> Khách từ chối
        </label>
      </RadioGroup>
      {accepted === 'no' && (
        <RadioGroup value={next} onValueChange={(v) => setNext(v as typeof next)} className='gap-2'>
          <label className='has-[[data-state=checked]]:border-primary flex items-center gap-2 rounded-md border p-3 text-sm'>
            <RadioGroupItem value='TIEP_TUC' /> Tiếp tục sửa theo phương án cũ
          </label>
          <label className='has-[[data-state=checked]]:border-primary flex items-center gap-2 rounded-md border p-3 text-sm'>
            <RadioGroupItem value='TRA_MAY' /> Dừng sửa, chuẩn bị trả thiết bị
          </label>
        </RadioGroup>
      )}
      <Field label='Phương thức xác nhận' required error={tried && !method && 'Chọn phương thức khách xác nhận.'}>
        {(id) => (
          <NativeSelect id={id} value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value=''>Chọn phương thức</option>
            {CONFIRM_METHODS.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </NativeSelect>
        )}
      </Field>
      <Field label='Ghi chú'>{(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder='Mã OTP, số phiếu ký, thời điểm gọi...' />}</Field>
    </FormDialog>
  )
}

export function PlanChangeDialog({ action, ...p }: P & { action: 'planChange' | 'planReview' | 'planSendQuote' | 'planResponse' }) {
  switch (action) {
    case 'planChange':
      return <Propose {...p} />
    case 'planReview':
      return <Review {...p} />
    case 'planSendQuote':
      return <SendQuote {...p} />
    case 'planResponse':
      return <Response {...p} />
  }
}
