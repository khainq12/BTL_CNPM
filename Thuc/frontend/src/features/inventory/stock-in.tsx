import { useState } from 'react'
import { useAction, useDb, useMe } from '@/api/hooks'
import * as api from '@/api/service'
import { approvalStatus } from '@/domain/approvals'
import { fmtDateTime } from '@/domain/format'
import { purchaseOpenQty } from '@/domain/parts'
import { waitingForParts } from '@/domain/sla'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, NativeSelect, SubmitButton } from '@/components/form-kit'
import { Empty, Guard, PageShell, Pill, Section, useName } from '@/components/woms'

// Nhập kho và đề nghị mua thêm (BR-17: mua thêm cần quản lý duyệt).
export function StockIn() {
  return (
    <Guard page='stockIn'>
      <Inner />
    </Guard>
  )
}

function Inner() {
  const db = useDb()
  const me = useMe()
  const name = useName()
  const isKho = me.role === 'KHO'
  const [partId, setPartId] = useState('')
  const [qty, setQty] = useState(1)
  const [note, setNote] = useState('')
  const [forPurchase, setForPurchase] = useState(true)
  const [buyPart, setBuyPart] = useState('')
  const [buyQty, setBuyQty] = useState(1)
  const [buyReason, setBuyReason] = useState('')
  const [tried, setTried] = useState<'in' | 'buy' | null>(null)
  // Sau mỗi lần nhập, ô "theo đề nghị mua" trở về mặc định để lần sau không vô tình bỏ ghi nhận.
  const stockIn = useAction(api.stockIn, { success: 'Đã nhập kho', onDone: () => (setQty(1), setNote(''), setTried(null), setForPurchase(true)) })
  const buy = useAction(api.requestPurchase, { success: 'Đã gửi đề nghị mua cho quản lý', onDone: () => (setBuyReason(''), setTried(null)) })
  const purchases = db.approvals.filter((a) => a.type === 'MUA_LINH_KIEN')
  const waiting = db.cases.filter(waitingForParts)
  // Đề nghị mua đã duyệt của linh kiện đang chọn mà chưa nhận đủ hàng: nhập kho sẽ ghi nhận cho các đề nghị này.
  const awaiting = purchases.filter((a) => a.partId === partId && a.status === 'DA_DUYET').reduce((s, a) => s + purchaseOpenQty(a), 0)

  return (
    <PageShell title='Nhập kho và mua thêm' description={waiting.length ? `${waiting.length} lệnh sửa chữa đang chờ linh kiện. Nhập kho xong, vào "Yêu cầu linh kiện" để giữ cho lệnh đó.` : undefined}>
      {isKho && (
        <div className='grid gap-6 lg:grid-cols-2'>
          <Section title='Nhập kho'>
            <form
              noValidate
              className='grid gap-4'
              onSubmit={(e) => {
                e.preventDefault()
                setTried('in')
                if (partId && qty > 0) stockIn.mutate([me, partId, qty, note, forPurchase && awaiting > 0])
              }}
            >
              <PartSelect value={partId} onChange={(v) => (setPartId(v), setForPurchase(true))} error={tried === 'in' && !partId && 'Chọn linh kiện.'} />
              <Field label='Số lượng nhập' required>
                {(id) => <Input id={id} type='number' min={1} className='w-32' value={qty} onChange={(e) => setQty(Number(e.target.value))} />}
              </Field>
              <Field label='Chứng từ, nhà cung cấp'>{(id) => <Input id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder='Phiếu nhập PN-1125, NCC Phong Vũ' />}</Field>
              {awaiting > 0 && (
                <label className='flex items-start gap-2 text-sm'>
                  <Checkbox checked={forPurchase} onCheckedChange={(v) => setForPurchase(v === true)} className='mt-0.5' />
                  <span>
                    Hàng về theo đề nghị mua đã duyệt (còn chờ {awaiting}). Bỏ chọn nếu hàng nhập không phải từ đề nghị mua.
                  </span>
                </label>
              )}
              <SubmitButton type='submit' pending={stockIn.isPending} className='justify-self-start'>
                Nhập kho
              </SubmitButton>
            </form>
          </Section>
          <Section title='Đề nghị mua thêm'>
            <form
              noValidate
              className='grid gap-4'
              onSubmit={(e) => {
                e.preventDefault()
                setTried('buy')
                if (buyPart && buyQty > 0 && buyReason.trim()) buy.mutate([me, buyPart, buyQty, buyReason])
              }}
            >
              <PartSelect value={buyPart} onChange={setBuyPart} error={tried === 'buy' && !buyPart && 'Chọn linh kiện.'} />
              <Field label='Số lượng' required>
                {(id) => <Input id={id} type='number' min={1} className='w-32' value={buyQty} onChange={(e) => setBuyQty(Number(e.target.value))} />}
              </Field>
              <Field label='Lý do' required error={tried === 'buy' && !buyReason.trim() && 'Ghi lý do mua.'}>
                {(id) => <Textarea id={id} rows={2} value={buyReason} onChange={(e) => setBuyReason(e.target.value)} />}
              </Field>
              <SubmitButton type='submit' pending={buy.isPending} variant='outline' className='justify-self-start'>
                Gửi quản lý duyệt
              </SubmitButton>
            </form>
          </Section>
        </div>
      )}
      <Section title='Đề nghị mua linh kiện'>
        {purchases.length === 0 ? (
          <Empty>Chưa có đề nghị.</Empty>
        ) : (
          <ul className='divide-y text-sm'>
            {purchases.map((a) => (
              <li key={a.id} className='flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5'>
                <span className='min-w-60 flex-1'>
                  <span className='font-medium'>{a.title}</span>
                  <span className='text-muted-foreground block text-xs'>
                    {a.detail} · {name(a.requestedBy)}, {fmtDateTime(a.requestedAt)}
                    {(a.status === 'TU_CHOI' || a.status === 'DA_HUY') && a.decisionNote ? ` · ${a.decisionNote}` : ''}
                  </span>
                </span>
                <Pill tone={approvalStatus(a).tone}>{approvalStatus(a).label}</Pill>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </PageShell>
  )
}

function PartSelect({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string | false }) {
  const db = useDb()
  return (
    <Field label='Linh kiện' required error={error}>
      {(id) => (
        <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value=''>Chọn linh kiện</option>
          {db.parts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.sku} · {p.name} (tồn {p.onHand})
            </option>
          ))}
        </NativeSelect>
      )}
    </Field>
  )
}
