import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useAction, useDb, useMe } from '@/api/hooks'
import * as api from '@/api/service'
import { fmtMoney } from '@/domain/format'
import { PARAMS } from '@/domain/params'
import {
  ACCESSORIES,
  CAUSE_LABEL,
  CONFIRM_METHODS,
  DECISION_LABEL,
  DECISION_RULES,
  INFO_REQUEST_REASONS,
  QC_CHECKLIST,
  WARRANTY_CHECK_LABEL,
  suggestRule,
  warrantyAuto,
} from '@/domain/rules'
import type { CauseType, EligibilityDecision, Photo, QcItem, WarrantyCase, WarrantyCheck, WorkOrder } from '@/domain/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { CancelButton, Field, FormDialog, FormSheet, NativeSelect, SubmitButton } from '@/components/form-kit'
import { InfoList } from '@/components/woms'
import { PartRows, QuoteBuilder, TaskRows, quoteTotal } from './editors'
import { techLoad, type ActionKey } from './logic'
import { PlanChangeDialog } from './plan-change'
import { PhotoPicker } from './photo-picker'

type P = { c: WarrantyCase; wo?: WorkOrder; onClose: () => void }

function useCaseAction<A extends unknown[]>(fn: (...a: A) => Promise<unknown>, success: string, onClose: () => void) {
  return useAction(fn, { success, onDone: onClose })
}

// ---------- Tiếp nhận ----------

function AcceptOnline({ c, onClose }: P) {
  const me = useMe()
  const [condition, setCondition] = useState('')
  const [acc, setAcc] = useState<string[]>([])
  const [none, setNone] = useState(false)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [tried, setTried] = useState(false)
  const m = useCaseAction(api.acceptOnline, 'Đã nhận máy và lập biên nhận', onClose)
  const errs = { condition: !condition.trim() && 'Mô tả tình trạng bên ngoài.', acc: !none && acc.length === 0 && 'Chọn phụ kiện hoặc "Không có phụ kiện".', photos: photos.length === 0 && 'Chụp ít nhất 1 ảnh hiện trạng.' }
  return (
    <FormDialog
      open
      onOpenChange={onClose}
      wide
      title='Nhận máy cho yêu cầu trực tuyến'
      description='Đối chiếu thiết bị khách mang tới với yêu cầu đã gửi, ghi hiện trạng để đối chiếu khi bàn giao.'
      onSubmit={() => {
        setTried(true)
        if (Object.values(errs).some(Boolean)) return
        m.mutate([me, c.id, c.version, { condition, accessories: acc, noAccessories: none, photos }])
      }}
      footer={
        <>
          <CancelButton onClick={onClose} />
          <SubmitButton type='submit' pending={m.isPending}>Nhận máy</SubmitButton>
        </>
      }
    >
      <Field label='Tình trạng bên ngoài' required error={tried && errs.condition}>
        {(id) => <Textarea id={id} rows={2} value={condition} onChange={(e) => setCondition(e.target.value)} placeholder='Trầy góc trái nắp máy, đủ phím.' />}
      </Field>
      <AccessoryPicker value={acc} onChange={setAcc} none={none} onNone={setNone} error={tried && errs.acc} />
      <PhotoPicker value={photos} onChange={setPhotos} error={tried && errs.photos} />
    </FormDialog>
  )
}

export function AccessoryPicker({ value, onChange, none, onNone, error }: { value: string[]; onChange: (v: string[]) => void; none: boolean; onNone: (v: boolean) => void; error?: string | false }) {
  return (
    <fieldset className='grid gap-2'>
      <legend className={`mb-1 text-sm font-medium ${error ? 'text-destructive' : ''}`}>
        Phụ kiện đi kèm<span className='text-destructive'>*</span>
      </legend>
      <div className='flex flex-wrap gap-x-5 gap-y-2'>
        {ACCESSORIES.map((a) => (
          <label key={a} className='flex items-center gap-2 text-sm'>
            <Checkbox disabled={none} checked={value.includes(a)} onCheckedChange={(on) => onChange(on ? [...value, a] : value.filter((x) => x !== a))} />
            {a}
          </label>
        ))}
      </div>
      <label className='flex items-center gap-2 text-sm font-medium'>
        <Checkbox
          checked={none}
          onCheckedChange={(on) => {
            onNone(on === true)
            if (on) onChange([])
          }}
        />
        Không có phụ kiện
      </label>
      {error && <p className='text-destructive text-xs'>{error}</p>}
    </fieldset>
  )
}

function CancelRequest({ c, onClose }: P) {
  const me = useMe()
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const m = useCaseAction(api.requestCancel, 'Đã gửi đề nghị hủy cho quản lý', onClose)
  return (
    <FormDialog
      open
      onOpenChange={onClose}
      title={`Đề nghị hủy phiếu ${c.code}`}
      description='Chỉ hủy được phiếu chưa xử lý. Quản lý sẽ duyệt trước khi phiếu chuyển sang Đã hủy (BR-30).'
      onSubmit={() => {
        setTried(true)
        if (reason.trim()) m.mutate([me, c.id, c.version, reason])
      }}
      footer={
        <>
          <CancelButton onClick={onClose} />
          <SubmitButton type='submit' variant='destructive' pending={m.isPending}>Gửi đề nghị hủy</SubmitButton>
        </>
      }
    >
      <Field label='Lý do hủy' required error={tried && !reason.trim() && 'Ghi lý do hủy.'}>
        {(id) => <Textarea id={id} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder='Khách đổi ý, mang máy về...' />}
      </Field>
    </FormDialog>
  )
}

// ---------- CSKH ----------

function Precheck({ c, onClose }: P) {
  const me = useMe()
  const db = useDb()
  const device = db.devices.find((d) => d.id === c.deviceId)!
  const [auto] = useState<WarrantyCheck>(() => warrantyAuto(device.purchaseDate, device.warrantyMonths))
  const [warranty, setWarranty] = useState<WarrantyCheck>(c.precheck?.warranty ?? auto)
  const [note, setNote] = useState(c.precheck?.note ?? '')
  const m = useCaseAction(api.savePrecheck, 'Đã lưu kết quả kiểm tra sơ bộ', onClose)
  const end = device.purchaseDate ? new Date(Date.parse(device.purchaseDate) + device.warrantyMonths * 30.44 * 86400_000) : undefined
  return (
    <FormDialog
      open
      onOpenChange={onClose}
      title='Kiểm tra bảo hành sơ bộ'
      description='Đối chiếu dữ liệu thời hạn và chính sách. Đây chưa phải kết luận bảo hành: kết luận chỉ đưa ra sau khi có chẩn đoán (C03).'
      onSubmit={() => m.mutate([me, c.id, c.version, { warranty, note }])}
      footer={
        <>
          <CancelButton onClick={onClose} />
          <SubmitButton type='submit' pending={m.isPending}>Lưu kết quả</SubmitButton>
        </>
      }
    >
      <InfoList
        rows={[
          ['Serial', <span className='font-mono'>{device.serial}</span>],
          ['Ngày mua', device.purchaseDate ? new Date(device.purchaseDate).toLocaleDateString('vi-VN') : 'Chưa có chứng từ'],
          ['Thời hạn', `${device.warrantyMonths} tháng (${device.policyCode})`],
          ['Hết hạn', end ? end.toLocaleDateString('vi-VN') : '—'],
        ]}
      />
      <Field label='Kết quả đối chiếu' hint={`Hệ thống gợi ý: ${WARRANTY_CHECK_LABEL[auto]}. Không tìm thấy serial thì chọn "Chưa đủ thông tin", không tự kết luận hết hạn (C05).`}>
        {(id) => (
          <NativeSelect id={id} value={warranty} onChange={(e) => setWarranty(e.target.value as WarrantyCheck)}>
            {Object.entries(WARRANTY_CHECK_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>
      <Field label='Ghi chú'>{(id) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
    </FormDialog>
  )
}

function RequestInfo({ c, onClose }: P) {
  const me = useMe()
  const [reason, setReason] = useState(INFO_REQUEST_REASONS[0])
  const [detail, setDetail] = useState('')
  const m = useCaseAction(api.requestInfo, 'Đã chuyển phiếu sang chờ bổ sung', onClose)
  return (
    <FormDialog
      open
      onOpenChange={onClose}
      title='Yêu cầu khách bổ sung'
      description='Phiếu chuyển sang "Chờ bổ sung thông tin". Liên hệ khách theo số điện thoại trên phiếu.'
      onSubmit={() => m.mutate([me, c.id, c.version, `${reason}${detail.trim() ? `. ${detail.trim()}` : ''}`])}
      footer={
        <>
          <CancelButton onClick={onClose} />
          <SubmitButton type='submit' pending={m.isPending}>Gửi yêu cầu</SubmitButton>
        </>
      }
    >
      <Field label='Thông tin cần bổ sung'>
        {(id) => (
          <NativeSelect id={id} value={reason} onChange={(e) => setReason(e.target.value)}>
            {INFO_REQUEST_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </NativeSelect>
        )}
      </Field>
      <Field label='Chi tiết cho khách (không bắt buộc)'>{(id) => <Textarea id={id} rows={2} value={detail} onChange={(e) => setDetail(e.target.value)} />}</Field>
    </FormDialog>
  )
}

function InfoSupplied({ c, onClose }: P) {
  const me = useMe()
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)
  const m = useCaseAction(api.infoSupplied, 'Đã ghi nhận thông tin bổ sung', onClose)
  return (
    <FormDialog
      open
      onOpenChange={onClose}
      title='Khách đã bổ sung thông tin'
      description={`Yêu cầu trước đó: ${c.infoRequest ?? '—'}`}
      onSubmit={() => {
        setTried(true)
        if (note.trim()) m.mutate([me, c.id, c.version, note])
      }}
      footer={
        <>
          <CancelButton onClick={onClose} />
          <SubmitButton type='submit' pending={m.isPending}>Xác nhận</SubmitButton>
        </>
      }
    >
      <Field label='Khách đã cung cấp gì' required error={tried && !note.trim() && 'Ghi rõ thông tin đã nhận.'}>
        {(id) => <Textarea id={id} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder='Đã nhận ảnh hóa đơn ngày 02/03/2026, khớp serial.' />}
      </Field>
    </FormDialog>
  )
}

// ---------- Điều phối ----------

function Assign({ c, wo, onClose, kind }: P & { kind: 'diagnosis' | 'repair' }) {
  const me = useMe()
  const db = useDb()
  const current = kind === 'diagnosis' ? c.diagnosisTechId : wo?.technicianId
  const techs = db.users.filter((u) => u.role === 'KTV' && u.active)
  const [tech, setTech] = useState(techs.find((t) => t.id !== current)?.id ?? '')
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const m = useCaseAction(kind === 'diagnosis' ? api.assignDiagnosis : api.assignRepair, 'Đã phân công', onClose)
  const load = tech ? techLoad(db, tech) : undefined
  const needReason = !!current
  return (
    <FormDialog
      open
      onOpenChange={onClose}
      title={kind === 'diagnosis' ? (current ? 'Đổi kỹ thuật viên chẩn đoán' : 'Giao kỹ thuật viên chẩn đoán') : current ? 'Đổi kỹ thuật viên sửa chữa' : `Phân công sửa ${wo?.code ?? ''}`}
      description='Chọn theo chuyên môn và khối lượng việc đang làm.'
      onSubmit={() => {
        setTried(true)
        if (!tech || (needReason && !reason.trim())) return
        m.mutate([me, c.id, c.version, tech, needReason ? reason : undefined])
      }}
      footer={
        <>
          <CancelButton onClick={onClose} />
          <SubmitButton type='submit' pending={m.isPending}>{load?.overloaded ? 'Vẫn giao' : 'Giao việc'}</SubmitButton>
        </>
      }
    >
      <RadioGroup value={tech} onValueChange={setTech} className='gap-2'>
        {techs.map((t) => {
          const l = techLoad(db, t.id)
          return (
            <label key={t.id} className='has-[[data-state=checked]]:border-primary flex items-center gap-3 rounded-md border p-3 text-sm'>
              <RadioGroupItem value={t.id} disabled={t.id === current} />
              <span className='flex-1'>
                {t.name}
                {t.id === current && <span className='text-muted-foreground'> (đang phụ trách)</span>}
              </span>
              <span className={l.overloaded ? 'font-medium text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}>
                {l.wo} WO · {l.diag} chẩn đoán
              </span>
            </label>
          )
        })}
      </RadioGroup>
      {load?.overloaded && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>Kỹ thuật viên đang quá tải</AlertTitle>
          <AlertDescription>Đang có {load.total} việc dở dang (ngưỡng {PARAMS.technicianOverload}). Cân nhắc giao người khác.</AlertDescription>
        </Alert>
      )}
      {needReason && (
        <Field label='Lý do đổi người' required error={tried && !reason.trim() && 'Đổi người phụ trách phải ghi lý do (BR-11).'}>
          {(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder='Kỹ thuật viên nghỉ phép, cần người có chuyên môn máy in...' />}
        </Field>
      )}
    </FormDialog>
  )
}

// ---------- Chẩn đoán (KTV) ----------

function Diagnosis({ c, onClose }: P) {
  const me = useMe()
  const [cause, setCause] = useState('')
  const [causeType, setCauseType] = useState<CauseType>('PHAN_CUNG')
  const [severity, setSeverity] = useState<'NHE' | 'TRUNG_BINH' | 'NANG'>('NHE')
  const [repairable, setRepairable] = useState(true)
  const [plan, setPlan] = useState('')
  const [tasks, setTasks] = useState([{ title: '', minutes: 30 }])
  const [parts, setParts] = useState<{ partId: string; qty: number }[]>([])
  const [labor, setLabor] = useState(0)
  const [tried, setTried] = useState(false)
  const m = useCaseAction(api.submitDiagnosis, 'Đã nộp biên bản chẩn đoán', onClose)
  const validTasks = tasks.filter((t) => t.title.trim())
  const errs = {
    cause: !cause.trim() && 'Nhập nguyên nhân lỗi.',
    plan: repairable && !plan.trim() && 'Nhập phương án sửa.',
    tasks: repairable && validTasks.length === 0 && 'Thêm ít nhất 1 công việc.',
  }
  return (
    <FormSheet
      open
      onOpenChange={onClose}
      title='Biên bản chẩn đoán'
      description={`${c.code}. Ghi nguyên nhân, khả năng sửa, phương án và linh kiện dự kiến. CSKH dựa vào biên bản này để kết luận bảo hành.`}
      onSubmit={() => {
        setTried(true)
        if (Object.values(errs).some(Boolean)) return
        m.mutate([me, c.id, c.version, { cause, causeType, severity, repairable, plan, tasks: repairable ? validTasks : [], parts: repairable ? parts.filter((p) => p.partId) : [], laborEstimate: labor }])
      }}
      footer={
        <>
          <CancelButton onClick={onClose} />
          <SubmitButton type='submit' pending={m.isPending}>Nộp biên bản</SubmitButton>
        </>
      }
    >
      <p className='bg-muted rounded-md p-3 text-sm'>
        <span className='font-medium'>Khách báo:</span> {c.symptom}
      </p>
      <div className='grid gap-4 sm:grid-cols-2'>
        <Field label='Phân loại nguyên nhân'>
          {(id) => (
            <NativeSelect id={id} value={causeType} onChange={(e) => setCauseType(e.target.value as CauseType)}>
              {Object.entries(CAUSE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field label='Mức độ'>
          {(id) => (
            <NativeSelect id={id} value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)}>
              <option value='NHE'>Nhẹ</option>
              <option value='TRUNG_BINH'>Trung bình</option>
              <option value='NANG'>Nặng</option>
            </NativeSelect>
          )}
        </Field>
      </div>
      <Field label='Nguyên nhân lỗi' required error={tried && errs.cause} hint='Ghi bằng chứng nếu lỗi do rơi vỡ, vào nước, tự tháo lắp (AT-03).'>
        {(id) => <Textarea id={id} rows={3} value={cause} onChange={(e) => setCause(e.target.value)} />}
      </Field>
      <label className='flex items-center gap-2 text-sm font-medium'>
        <Checkbox checked={!repairable} onCheckedChange={(v) => setRepairable(v !== true)} />
        Không thể sửa tại trung tâm (D10)
      </label>
      {repairable && (
        <>
          <Field label='Phương án sửa' required error={tried && errs.plan}>
            {(id) => <Textarea id={id} rows={2} value={plan} onChange={(e) => setPlan(e.target.value)} />}
          </Field>
          <TaskRows label='Công việc dự kiến' value={tasks} onChange={setTasks} error={tried && errs.tasks} />
          <PartRows label='Linh kiện dự kiến' value={parts} onChange={setParts} />
          <Field label='Tiền công ước tính (nếu sửa có phí)' hint='Để 0 nếu dự kiến bảo hành miễn phí.'>
            {(id) => <Input id={id} type='number' min={0} step={10000} value={labor} onChange={(e) => setLabor(Number(e.target.value))} className='w-48' />}
          </Field>
        </>
      )}
    </FormSheet>
  )
}

// ---------- Kết luận bảo hành, báo giá (CSKH) ----------

function Eligibility({ c, onClose }: P) {
  const me = useMe()
  const db = useDb()
  const d = c.diagnosis!
  const suggested = suggestRule(c.precheck?.warranty, d.causeType, d.repairable)
  const exceptionDone = c.eligibility?.exceptionApproved
  const [rule, setRule] = useState(exceptionDone === true ? 'D6' : suggested)
  const defaultDecision = (code: string): EligibilityDecision => {
    if (exceptionDone === true) return 'MIEN_PHI'
    return DECISION_RULES.find((r) => r.code === code)!.decision
  }
  const [decision, setDecision] = useState<EligibilityDecision>(defaultDecision(rule))
  const [reason, setReason] = useState('')
  const [items, setItems] = useState(() =>
    d.parts.map((p) => {
      const part = db.parts.find((x) => x.id === p.partId)!
      return { label: part.name, qty: p.qty, unitPrice: part.price }
    })
  )
  const [labor, setLabor] = useState(d.laborEstimate)
  const [tried, setTried] = useState(false)
  const m = useCaseAction(api.decideEligibility, 'Đã lưu kết luận bảo hành', onClose)
  const total = quoteTotal(items, labor)
  const allowed: EligibilityDecision[] = !d.repairable ? ['KHONG_SUA'] : exceptionDone === false ? ['CO_PHI', 'KHONG_SUA'] : exceptionDone === true ? ['MIEN_PHI', 'CO_PHI', 'KHONG_SUA'] : ['MIEN_PHI', 'CO_PHI', 'NGOAI_LE', 'KHONG_SUA']
  return (
    <FormSheet
      open
      onOpenChange={onClose}
      title='Kết luận điều kiện bảo hành'
      description='CSKH là người kết luận (C01), dựa trên kiểm tra sơ bộ, biên bản chẩn đoán và bảng quyết định D1–D10.'
      onSubmit={() => {
        setTried(true)
        if (!reason.trim()) return
        m.mutate([me, c.id, c.version, { decision, ruleCode: rule, reason, quote: decision === 'CO_PHI' ? { items, labor } : undefined }])
      }}
      footer={
        <>
          <CancelButton onClick={onClose} />
          <SubmitButton type='submit' pending={m.isPending}>
            {decision === 'CO_PHI' && total > PARAMS.quoteApprovalThreshold ? 'Gửi quản lý duyệt báo giá' : decision === 'CO_PHI' ? 'Lưu và gửi báo giá' : decision === 'NGOAI_LE' ? 'Gửi quản lý duyệt' : 'Lưu kết luận'}
          </SubmitButton>
        </>
      }
    >
      <div className='bg-muted grid gap-1 rounded-md p-3 text-sm'>
        <p>
          <span className='font-medium'>Kiểm tra sơ bộ:</span> {c.precheck ? WARRANTY_CHECK_LABEL[c.precheck.warranty] : 'chưa có'}
        </p>
        <p>
          <span className='font-medium'>Chẩn đoán:</span> {CAUSE_LABEL[d.causeType]}. {d.cause}
        </p>
        {!d.repairable && <p className='font-medium'>Kỹ thuật viên kết luận không sửa được tại trung tâm.</p>}
        {exceptionDone !== undefined && <p className='font-medium'>Quản lý đã {exceptionDone ? 'duyệt' : 'từ chối'} đề nghị ngoại lệ.</p>}
        {c.quotes.at(-1)?.status === 'TU_CHOI_DUYET' && <p className='font-medium'>Báo giá trước bị quản lý từ chối. Lập báo giá mới hoặc chọn hướng khác.</p>}
      </div>
      <Field label='Quy tắc áp dụng' hint={`Gợi ý theo dữ liệu: ${suggested}. Có thể chọn khác nếu có căn cứ.`}>
        {(id) => (
          <NativeSelect
            id={id}
            value={rule}
            onChange={(e) => {
              setRule(e.target.value)
              const dd = defaultDecision(e.target.value)
              if (allowed.includes(dd)) setDecision(dd)
            }}
          >
            {DECISION_RULES.map((r) => (
              <option key={r.code} value={r.code}>
                {r.code} · {r.when}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>
      <fieldset className='grid gap-2'>
        <legend className='mb-1 text-sm font-medium'>Kết luận</legend>
        <RadioGroup value={decision} onValueChange={(v) => setDecision(v as EligibilityDecision)} className='gap-2 sm:grid-cols-2'>
          {(Object.keys(DECISION_LABEL) as EligibilityDecision[]).map((k) => (
            <label key={k} className='has-[[data-state=checked]]:border-primary flex items-center gap-2 rounded-md border p-3 text-sm has-[:disabled]:opacity-50'>
              <RadioGroupItem value={k} disabled={!allowed.includes(k)} />
              {DECISION_LABEL[k]}
            </label>
          ))}
        </RadioGroup>
      </fieldset>
      <Field label='Lý do, căn cứ' required error={tried && !reason.trim() && 'Ghi lý do kết luận (BR-05).'}>
        {(id) => <Textarea id={id} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />}
      </Field>
      {decision === 'CO_PHI' && <QuoteBuilder title={`Báo giá v${c.quotes.length + 1}`} items={items} onItems={setItems} labor={labor} onLabor={setLabor} />}
    </FormSheet>
  )
}

function SendQuote({ c, onClose }: P) {
  const me = useMe()
  const q = c.quotes.at(-1)!
  const m = useCaseAction(api.sendApprovedQuote, 'Đã gửi báo giá cho khách', onClose)
  return (
    <FormDialog
      open
      onOpenChange={onClose}
      title={`Gửi báo giá v${q.version} cho khách`}
      description='Báo giá đã được quản lý duyệt. Khách xác nhận qua Customer Portal hoặc tại quầy.'
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

function QuoteResponse({ c, onClose }: P) {
  const me = useMe()
  const q = c.quotes.at(-1)!
  const [accepted, setAccepted] = useState<'yes' | 'no'>('yes')
  const [method, setMethod] = useState('')
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)
  const m = useCaseAction(api.recordQuoteResponse, 'Đã ghi nhận phản hồi của khách', onClose)
  return (
    <FormDialog
      open
      onOpenChange={onClose}
      title={`Phản hồi báo giá v${q.version} · ${fmtMoney(q.total)}`}
      description='Chỉ bắt đầu sửa có phí khi khách đồng ý báo giá hiện hành (BR-08). Xác nhận phải truy vết được (C08).'
      onSubmit={() => {
        setTried(true)
        if (method) m.mutate([me, c.id, c.version, { accepted: accepted === 'yes', method, note }])
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
          <RadioGroupItem value='yes' /> Khách đồng ý sửa
        </label>
        <label className='has-[[data-state=checked]]:border-primary flex items-center gap-2 rounded-md border p-3 text-sm'>
          <RadioGroupItem value='no' /> Khách từ chối
        </label>
      </RadioGroup>
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
      {accepted === 'no' && <p className='text-muted-foreground text-sm'>Phiếu chuyển sang "Chuẩn bị trả không sửa". Có thể thu phí kiểm tra nếu khách đã đồng ý trước (PARAM-07).</p>}
    </FormDialog>
  )
}

function ReturnConfirm({ c, onClose }: P) {
  const me = useMe()
  const [text, setText] = useState(c.eligibility?.decision === 'KHONG_SUA' ? c.eligibility.reason : '')
  const [fee, setFee] = useState(false)
  const [tried, setTried] = useState(false)
  const m = useCaseAction(api.confirmReturn, 'Thiết bị đã sẵn sàng trả khách', onClose)
  return (
    <FormDialog
      open
      onOpenChange={onClose}
      title='Kết luận trả thiết bị không sửa'
      description='Bàn giao không sửa không cần QC đạt, nhưng phải có kết luận rõ ràng (C14, BR-23).'
      onSubmit={() => {
        setTried(true)
        if (text.trim()) m.mutate([me, c.id, c.version, { text, feeAgreed: fee }])
      }}
      footer={
        <>
          <CancelButton onClick={onClose} />
          <SubmitButton type='submit' pending={m.isPending}>Chuyển chờ bàn giao</SubmitButton>
        </>
      }
    >
      <Field label='Kết luận gửi khách' required error={tried && !text.trim() && 'Ghi kết luận.'}>
        {(id) => <Textarea id={id} rows={3} value={text} onChange={(e) => setText(e.target.value)} />}
      </Field>
      <label className='flex items-center gap-2 text-sm'>
        <Checkbox checked={fee} onCheckedChange={(v) => setFee(v === true)} />
        Khách đã được báo trước và đồng ý phí kiểm tra {fmtMoney(PARAMS.inspectionFee)}
      </label>
    </FormDialog>
  )
}

// ---------- Kỹ thuật viên ----------

function StartRepair({ c, wo, onClose }: P) {
  const me = useMe()
  const m = useCaseAction(api.startRepair, 'Đã bắt đầu sửa', onClose)
  return (
    <FormDialog
      open
      onOpenChange={onClose}
      title={c.status === 'REWORK' ? 'Nhận xử lý lại' : `Bắt đầu sửa ${wo?.code}`}
      description={c.status === 'REWORK' ? `Lỗi QC ghi nhận: ${c.qc.at(-1)?.defect ?? '—'}` : 'Đã đủ điều kiện: có phương án xác nhận, được phân công, đã nhận đủ linh kiện (BR-13).'}
      onSubmit={() => m.mutate([me, c.id, c.version])}
      footer={
        <>
          <CancelButton onClick={onClose} />
          <SubmitButton type='submit' pending={m.isPending}>Bắt đầu</SubmitButton>
        </>
      }
    >
      <span />
    </FormDialog>
  )
}

function FinishRepair({ c, wo, onClose }: P) {
  const me = useMe()
  const db = useDb()
  const [used, setUsed] = useState<Record<string, number>>(Object.fromEntries((wo?.parts ?? []).map((p) => [p.partId, p.issued - p.used])))
  const [note, setNote] = useState('')
  const m = useCaseAction(api.finishRepair, 'Đã chuyển kiểm tra chất lượng', onClose)
  return (
    <FormDialog
      open
      onOpenChange={onClose}
      title='Hoàn tất sửa chữa'
      description='Ghi số linh kiện đã dùng. Phần chưa dùng sẽ chờ kho xác nhận nhận lại (BR-16).'
      onSubmit={() => m.mutate([me, c.id, c.version, used, note])}
      footer={
        <>
          <CancelButton onClick={onClose} />
          <SubmitButton type='submit' pending={m.isPending}>Chuyển QC</SubmitButton>
        </>
      }
    >
      {(wo?.parts ?? []).map((p) => {
        const part = db.parts.find((x) => x.id === p.partId)!
        const max = p.issued - p.used
        return (
          <Field key={p.partId} label={`${part.name} (đã nhận ${max})`}>
            {(id) => <Input id={id} type='number' min={0} max={max} className='w-24' value={used[p.partId]} onChange={(e) => setUsed({ ...used, [p.partId]: Math.min(max, Math.max(0, Number(e.target.value))) })} />}
          </Field>
        )
      })}
      <Field label='Ghi chú kết quả sửa'>{(id) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
    </FormDialog>
  )
}

// ---------- QC ----------

function Qc({ c, onClose }: P) {
  const me = useMe()
  const db = useDb()
  const device = db.devices.find((d) => d.id === c.deviceId)!
  const [items, setItems] = useState<QcItem[]>(QC_CHECKLIST[device.kind].map((i) => ({ ...i, pass: false, note: '' })))
  const [defect, setDefect] = useState('')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [tried, setTried] = useState(false)
  const m = useCaseAction(api.submitQc, 'Đã lưu kết quả kiểm tra', onClose)
  const pass = items.every((i) => !i.mandatory || i.pass)
  const last = c.reworkCount >= PARAMS.maxRework
  return (
    <FormSheet
      open
      onOpenChange={onClose}
      title={`Kiểm tra chất lượng lần ${c.qc.length + 1}`}
      description='Đạt khi mọi tiêu chí bắt buộc đều đạt (BR-20). Không đạt thì ghi lỗi còn tồn tại và chuyển sửa lại.'
      onSubmit={() => {
        setTried(true)
        if (!pass && !defect.trim()) return
        m.mutate([me, c.id, c.version, items, defect, photos])
      }}
      footer={
        <>
          <CancelButton onClick={onClose} />
          <SubmitButton type='submit' pending={m.isPending} variant={pass ? 'default' : 'destructive'}>
            {pass ? 'Xác nhận đạt' : last ? 'Không đạt, chuyển quản lý' : 'Không đạt, chuyển sửa lại'}
          </SubmitButton>
        </>
      }
    >
      <p className='bg-muted rounded-md p-3 text-sm'>
        <span className='font-medium'>Lỗi ban đầu:</span> {c.symptom}
        <br />
        <span className='font-medium'>Đã làm:</span> {api.currentPlan(c)}
        {c.reworkCount > 0 && (
          <>
            <br />
            <span className='font-medium'>Đã sửa lại:</span> {c.reworkCount}/{PARAMS.maxRework} lần
          </>
        )}
      </p>
      <ul className='grid gap-2'>
        {items.map((it, i) => (
          <li key={it.label} className='grid gap-2 rounded-md border p-3'>
            <label className='flex items-center gap-2 text-sm'>
              <Checkbox checked={it.pass} onCheckedChange={(v) => setItems(items.map((x, j) => (j === i ? { ...x, pass: v === true } : x)))} />
              <span className='flex-1'>{it.label}</span>
              <span className='text-muted-foreground text-xs'>{it.mandatory ? 'Bắt buộc' : 'Không bắt buộc'}</span>
            </label>
            {!it.pass && <Input aria-label={`Ghi chú: ${it.label}`} placeholder='Ghi chú nếu không đạt' value={it.note} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} />}
          </li>
        ))}
      </ul>
      {!pass && (
        <Field label='Lỗi còn tồn tại' required error={tried && !defect.trim() && 'Mô tả lỗi để kỹ thuật viên xử lý lại.'}>
          {(id) => <Textarea id={id} rows={2} value={defect} onChange={(e) => setDefect(e.target.value)} />}
        </Field>
      )}
      <PhotoPicker label='Ảnh kết quả kiểm tra' required={false} max={4} hint='Không bắt buộc. Chụp khi cần chứng minh tình trạng sau kiểm tra, tối đa 4 ảnh.' value={photos} onChange={setPhotos} />
      {!pass && last && (
        <Alert>
          <AlertTriangle />
          <AlertDescription>Đã sửa lại {c.reworkCount} lần. Lần này không đạt sẽ chuyển quản lý quyết định, không tự động đổi máy (BR-22, C13).</AlertDescription>
        </Alert>
      )}
    </FormSheet>
  )
}

// ---------- Bàn giao ----------

function Handover({ c, onClose }: P) {
  const me = useMe()
  const db = useDb()
  const cu = db.customers.find((x) => x.id === c.customerId)!
  const [relation, setRelation] = useState<'CHINH_CHU' | 'NHAN_HO'>('CHINH_CHU')
  const [name, setName] = useState(cu.name)
  const [phone, setPhone] = useState(cu.phone)
  const [idNote, setIdNote] = useState('')
  const [accOk, setAccOk] = useState(false)
  const [condOk, setCondOk] = useState(false)
  const [signed, setSigned] = useState(false)
  const [rating, setRating] = useState<number | undefined>()
  const [feedback, setFeedback] = useState('')
  const [tried, setTried] = useState(false)
  const m = useCaseAction(api.handover, 'Đã bàn giao, phiếu hoàn tất', onClose)
  const fee = c.returnConclusion?.feeAgreed ? PARAMS.inspectionFee : 0
  const errs = { name: !name.trim() && 'Nhập tên người nhận.', id: !idNote.trim() && 'Ghi cách xác thực người nhận.', checks: !(accOk && condOk && signed) && 'Đối chiếu đủ 3 mục trước khi bàn giao (BR-24).' }
  return (
    <FormSheet
      open
      onOpenChange={onClose}
      title={c.returnConclusion ? 'Bàn giao thiết bị không sửa' : 'Bàn giao thiết bị'}
      description='Đối chiếu đúng người nhận, thiết bị và phụ kiện với lúc tiếp nhận, có xác nhận rồi mới hoàn tất (AT-12).'
      onSubmit={() => {
        setTried(true)
        if (Object.values(errs).some(Boolean)) return
        m.mutate([me, c.id, c.version, { recipientName: name, recipientPhone: phone, relation, idNote, accessoriesOk: accOk, conditionOk: condOk, signed, inspectionFee: fee, rating, feedback }])
      }}
      footer={
        <>
          <CancelButton onClick={onClose} />
          <SubmitButton type='submit' pending={m.isPending}>Xác nhận bàn giao</SubmitButton>
        </>
      }
    >
      <RadioGroup value={relation} onValueChange={(v) => setRelation(v as typeof relation)} className='grid-cols-2'>
        <label className='has-[[data-state=checked]]:border-primary flex items-center gap-2 rounded-md border p-3 text-sm'>
          <RadioGroupItem value='CHINH_CHU' /> Chính chủ
        </label>
        <label className='has-[[data-state=checked]]:border-primary flex items-center gap-2 rounded-md border p-3 text-sm'>
          <RadioGroupItem value='NHAN_HO' /> Người nhận hộ
        </label>
      </RadioGroup>
      <div className='grid gap-4 sm:grid-cols-2'>
        <Field label='Họ tên người nhận' required error={tried && errs.name}>
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label='Số điện thoại'>{(id) => <Input id={id} value={phone} onChange={(e) => setPhone(e.target.value)} />}</Field>
      </div>
      <Field label='Xác thực người nhận' required error={tried && errs.id} hint={relation === 'NHAN_HO' ? 'Nhận hộ: ghi giấy ủy quyền hoặc xác nhận qua điện thoại chủ máy.' : 'Ví dụ: đối chiếu biên nhận gốc, CCCD.'}>
        {(id) => <Input id={id} value={idNote} onChange={(e) => setIdNote(e.target.value)} />}
      </Field>
      <fieldset className='grid gap-2 rounded-md border p-3'>
        <legend className='px-1 text-sm font-medium'>Đối chiếu với lúc tiếp nhận</legend>
        <p className='text-muted-foreground text-sm'>
          Phụ kiện lúc nhận: {c.noAccessories ? 'Không có phụ kiện' : c.accessories.join(', ')}. Tình trạng: {c.condition || '—'}
        </p>
        <label className='flex items-center gap-2 text-sm'>
          <Checkbox checked={accOk} onCheckedChange={(v) => setAccOk(v === true)} /> Đã trả đủ phụ kiện
        </label>
        <label className='flex items-center gap-2 text-sm'>
          <Checkbox checked={condOk} onCheckedChange={(v) => setCondOk(v === true)} /> Khách đã kiểm tra thiết bị cùng nhân viên
        </label>
        <label className='flex items-center gap-2 text-sm'>
          <Checkbox checked={signed} onCheckedChange={(v) => setSigned(v === true)} /> Người nhận đã ký biên bản bàn giao
        </label>
        {tried && errs.checks && <p className='text-destructive text-xs'>{errs.checks}</p>}
      </fieldset>
      {fee > 0 && <p className='text-sm'>Thu phí kiểm tra: <span className='font-semibold'>{fmtMoney(fee)}</span></p>}
      {c.quotes.at(-1)?.status === 'KHACH_DONG_Y' && <p className='text-sm'>Thu tiền sửa theo báo giá: <span className='font-semibold'>{fmtMoney(c.quotes.at(-1)!.total)}</span></p>}
      <Field label='Khách đánh giá (không bắt buộc)'>
        {(id) => (
          <NativeSelect id={id} value={rating ?? ''} onChange={(e) => setRating(e.target.value ? Number(e.target.value) : undefined)} className='w-48'>
            <option value=''>Khách chưa đánh giá</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} sao
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>
      <Field label='Góp ý của khách'>{(id) => <Textarea id={id} rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)} />}</Field>
    </FormSheet>
  )
}

function Complaint({ c, onClose }: P) {
  const me = useMe()
  const [content, setContent] = useState('')
  const [tried, setTried] = useState(false)
  const m = useCaseAction((cid: string, text: string) => api.createComplaint(me, cid, text), 'Đã ghi nhận khiếu nại', onClose)
  return (
    <FormDialog
      open
      onOpenChange={onClose}
      title={`Khiếu nại cho phiếu ${c.code}`}
      onSubmit={() => {
        setTried(true)
        if (content.trim()) m.mutate([c.id, content])
      }}
      footer={
        <>
          <CancelButton onClick={onClose} />
          <SubmitButton type='submit' pending={m.isPending}>Ghi nhận</SubmitButton>
        </>
      }
    >
      <Field label='Nội dung khiếu nại' required error={tried && !content.trim() && 'Nhập nội dung.'}>
        {(id) => <Textarea id={id} rows={4} value={content} onChange={(e) => setContent(e.target.value)} />}
      </Field>
    </FormDialog>
  )
}

export function ActionDialog({ action, ...p }: P & { action: ActionKey }) {
  switch (action) {
    case 'acceptOnline':
      return <AcceptOnline {...p} />
    case 'cancel':
      return <CancelRequest {...p} />
    case 'precheck':
      return <Precheck {...p} />
    case 'requestInfo':
      return <RequestInfo {...p} />
    case 'infoSupplied':
      return <InfoSupplied {...p} />
    case 'assignDiagnosis':
      return <Assign {...p} kind='diagnosis' />
    case 'assignRepair':
      return <Assign {...p} kind='repair' />
    case 'diagnosis':
      return <Diagnosis {...p} />
    case 'eligibility':
      return <Eligibility {...p} />
    case 'sendQuote':
      return <SendQuote {...p} />
    case 'quoteResponse':
      return <QuoteResponse {...p} />
    case 'returnConfirm':
      return <ReturnConfirm {...p} />
    case 'startRepair':
      return <StartRepair {...p} />
    case 'finishRepair':
      return <FinishRepair {...p} />
    case 'qc':
      return <Qc {...p} />
    case 'handover':
      return <Handover {...p} />
    case 'complaint':
      return <Complaint {...p} />
    case 'planChange':
    case 'planReview':
    case 'planSendQuote':
    case 'planResponse':
      return <PlanChangeDialog action={action} {...p} />
    default:
      return null
  }
}
