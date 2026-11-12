import { useState } from 'react'
import { useAction, useDb, useMe } from '@/api/hooks'
import * as api from '@/api/service'
import { fmtDateTime } from '@/domain/format'
import type { Complaint } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { CancelButton, Field, FormDialog, NativeSelect, SubmitButton } from '@/components/form-kit'
import { CaseLink, Empty, Guard, PageShell, Pill, useName } from '@/components/woms'

const ST = {
  MOI: ['Mới', 'wait'],
  DANG_XU_LY: ['Đang xử lý', 'info'],
  CHUYEN_QUAN_LY: ['Chuyển quản lý', 'warn'],
  DA_GIAI_QUYET: ['Đã giải quyết', 'done'],
} as const

// S-91 Khiếu nại (StRS-05, StRS-11). Tạo khiếu nại từ chi tiết phiếu đã hoàn tất.
export function Complaints() {
  return (
    <Guard page='complaints'>
      <Inner />
    </Guard>
  )
}

function Inner() {
  const db = useDb()
  const name = useName()
  const [open, setOpen] = useState<Complaint | null>(null)
  const rows = [...db.complaints].sort((a, b) => Number(a.status === 'DA_GIAI_QUYET') - Number(b.status === 'DA_GIAI_QUYET') || b.updatedAt.localeCompare(a.updatedAt))
  return (
    <PageShell title='Khiếu nại' description='CSKH tiếp nhận và giải đáp; vượt thẩm quyền thì chuyển quản lý. Ghi nhận khiếu nại mới từ trang chi tiết phiếu.'>
      {rows.length === 0 ? (
        <Empty className='rounded-lg border'>Chưa có khiếu nại.</Empty>
      ) : (
        <ul className='bg-card divide-y rounded-lg border'>
          {rows.map((q) => {
            const c = db.cases.find((x) => x.id === q.caseId)
            return (
              <li key={q.id} className='flex flex-wrap items-start gap-x-4 gap-y-2 p-4 text-sm'>
                <div className='min-w-64 flex-1'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <span className='font-medium'>{q.code}</span>
                    {c && <CaseLink c={c} />}
                    <Pill tone={ST[q.status][1]}>{ST[q.status][0]}</Pill>
                  </div>
                  <p className='mt-1'>{q.content}</p>
                  {q.resolution && <p className='text-muted-foreground'>Kết quả: {q.resolution}</p>}
                  <p className='text-muted-foreground mt-1 text-xs'>
                    {name(q.createdBy)} · {fmtDateTime(q.createdAt)} · cập nhật {fmtDateTime(q.updatedAt)}
                  </p>
                </div>
                {q.status !== 'DA_GIAI_QUYET' && (
                  <Button size='sm' variant='outline' onClick={() => setOpen(q)}>
                    Cập nhật
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {open && <Update q={open} onClose={() => setOpen(null)} />}
    </PageShell>
  )
}

function Update({ q, onClose }: { q: Complaint; onClose: () => void }) {
  const me = useMe()
  const options = me.role === 'CSKH' ? (['DANG_XU_LY', 'CHUYEN_QUAN_LY', 'DA_GIAI_QUYET'] as const) : (['DANG_XU_LY', 'DA_GIAI_QUYET'] as const)
  const [status, setStatus] = useState<(typeof options)[number]>(options[0])
  const [text, setText] = useState(q.resolution ?? '')
  const [tried, setTried] = useState(false)
  const m = useAction(api.updateComplaint, { success: 'Đã cập nhật khiếu nại', onDone: onClose })
  const need = status === 'DA_GIAI_QUYET'
  return (
    <FormDialog
      open
      onOpenChange={onClose}
      title={`Cập nhật ${q.code}`}
      description={q.content}
      onSubmit={() => {
        setTried(true)
        if (need && !text.trim()) return
        m.mutate([me, q.id, status, text])
      }}
      footer={
        <>
          <CancelButton onClick={onClose} />
          <SubmitButton type='submit' pending={m.isPending}>Lưu</SubmitButton>
        </>
      }
    >
      <Field label='Tình trạng'>
        {(id) => (
          <NativeSelect id={id} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            {options.map((o) => (
              <option key={o} value={o}>
                {ST[o][0]}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>
      <Field label={need ? 'Kết quả giải quyết' : 'Ghi chú xử lý'} required={need} error={tried && need && !text.trim() && 'Ghi kết quả giải quyết.'}>
        {(id) => <Textarea id={id} rows={3} value={text} onChange={(e) => setText(e.target.value)} />}
      </Field>
    </FormDialog>
  )
}
