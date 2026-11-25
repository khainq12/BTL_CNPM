import { useMemo } from 'react'
import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { useDb } from '@/api/hooks'
import { fmtMoney } from '@/domain/format'
import { PARAMS } from '@/domain/params'
import type { Quote } from '@/domain/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/form-kit'

// Các khối nhập lặp lại giữa biên bản chẩn đoán, kết luận bảo hành và đổi phương án.

export type TaskRow = { title: string; minutes: number }
export type PartRow = { partId: string; qty: number }
export type QuoteItem = Quote['items'][number]

export function TaskRows({ label, value, onChange, error, placeholder = 'Thay bàn phím' }: { label: string; value: TaskRow[]; onChange: (v: TaskRow[]) => void; error?: string | false; placeholder?: string }) {
  const set = (i: number, patch: Partial<TaskRow>) => onChange(value.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  return (
    <fieldset className='grid gap-2'>
      <legend className='mb-1 text-sm font-medium'>{label}</legend>
      {value.map((t, i) => (
        <div key={i} className='flex gap-2'>
          <Input aria-label={`Công việc ${i + 1}`} value={t.title} placeholder={placeholder} onChange={(e) => set(i, { title: e.target.value })} />
          <Input aria-label={`Số phút công việc ${i + 1}`} type='number' min={5} className='w-24' value={t.minutes} onChange={(e) => set(i, { minutes: Number(e.target.value) })} />
          <Button type='button' variant='ghost' size='icon' aria-label='Xóa công việc' onClick={() => onChange(value.filter((_, j) => j !== i))}>
            <Trash2 />
          </Button>
        </div>
      ))}
      {error && <p className='text-destructive text-xs'>{error}</p>}
      <Button type='button' variant='outline' size='sm' className='justify-self-start' onClick={() => onChange([...value, { title: '', minutes: 30 }])}>
        <Plus /> Thêm công việc
      </Button>
    </fieldset>
  )
}

export function PartRows({ label, value, onChange }: { label: string; value: PartRow[]; onChange: (v: PartRow[]) => void }) {
  const db = useDb()
  const set = (i: number, patch: Partial<PartRow>) => onChange(value.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  return (
    <fieldset className='grid gap-2'>
      <legend className='mb-1 text-sm font-medium'>{label}</legend>
      {value.map((p, i) => {
        const part = db.parts.find((x) => x.id === p.partId)
        return (
          <div key={i} className='flex items-center gap-2'>
            <NativeSelect aria-label={`Linh kiện ${i + 1}`} value={p.partId} onChange={(e) => set(i, { partId: e.target.value })}>
              <option value=''>Chọn linh kiện</option>
              {db.parts.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.sku} · {x.name} (khả dụng {x.onHand - x.reserved})
                </option>
              ))}
            </NativeSelect>
            <Input aria-label='Số lượng' type='number' min={1} className='w-20' value={p.qty} onChange={(e) => set(i, { qty: Math.max(1, Number(e.target.value)) })} />
            <span className='text-muted-foreground w-28 shrink-0 text-right text-xs'>{part ? fmtMoney(part.price * p.qty) : ''}</span>
            <Button type='button' variant='ghost' size='icon' aria-label='Xóa linh kiện' onClick={() => onChange(value.filter((_, j) => j !== i))}>
              <Trash2 />
            </Button>
          </div>
        )
      })}
      <Button type='button' variant='outline' size='sm' className='justify-self-start' onClick={() => onChange([...value, { partId: '', qty: 1 }])}>
        <Plus /> Thêm linh kiện
      </Button>
    </fieldset>
  )
}

export function quoteTotal(items: QuoteItem[], labor: number) {
  return items.reduce((s, i) => s + i.qty * i.unitPrice, 0) + labor
}

// Bỏ dòng "Thêm hạng mục" chưa điền gì (tên trống, số lượng 1, đơn giá 0) trước khi gửi.
// Dòng đã sửa dở (có giá hoặc đổi số lượng nhưng chưa có tên) vẫn gửi để service báo lỗi rõ.
export const untouchedRowsRemoved = (items: QuoteItem[]) => items.filter((i) => i.label.trim() || i.unitPrice !== 0 || i.qty !== 1)

export function QuoteBuilder({ title, items, onItems, labor, onLabor }: { title: string; items: QuoteItem[]; onItems: (v: QuoteItem[]) => void; labor: number; onLabor: (v: number) => void }) {
  const total = useMemo(() => quoteTotal(items, labor), [items, labor])
  const set = (i: number, patch: Partial<QuoteItem>) => onItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  return (
    <fieldset className='grid gap-2'>
      <legend className='mb-1 text-sm font-medium'>{title}</legend>
      {items.map((it, i) => (
        <div key={i} className='flex gap-2'>
          <Input aria-label='Hạng mục' value={it.label} onChange={(e) => set(i, { label: e.target.value })} />
          <Input aria-label='Số lượng' type='number' min={1} className='w-16' value={it.qty} onChange={(e) => set(i, { qty: Number(e.target.value) })} />
          <Input aria-label='Đơn giá' type='number' min={0} step={10000} className='w-36' value={it.unitPrice} onChange={(e) => set(i, { unitPrice: Number(e.target.value) })} />
          <Button type='button' variant='ghost' size='icon' aria-label='Xóa hạng mục' onClick={() => onItems(items.filter((_, j) => j !== i))}>
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button type='button' variant='outline' size='sm' className='justify-self-start' onClick={() => onItems([...items, { label: '', qty: 1, unitPrice: 0 }])}>
        <Plus /> Thêm hạng mục
      </Button>
      <div className='flex items-center gap-2'>
        <span className='text-sm'>Tiền công</span>
        <Input aria-label='Tiền công' type='number' min={0} step={10000} className='w-36' value={labor} onChange={(e) => onLabor(Number(e.target.value))} />
      </div>
      <p className='text-right font-semibold tabular-nums'>Tổng {fmtMoney(total)}</p>
      {total > PARAMS.quoteApprovalThreshold && (
        <Alert>
          <AlertTriangle />
          <AlertDescription>Tổng vượt {fmtMoney(PARAMS.quoteApprovalThreshold)}: báo giá phải được quản lý duyệt trước khi gửi khách (BR-07).</AlertDescription>
        </Alert>
      )}
    </fieldset>
  )
}
