import { useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { AlertTriangle, Check, Circle } from 'lucide-react'
import { useAction, useDb, useMe } from '@/api/hooks'
import * as api from '@/api/service'
import { DEVICE_KIND_LABEL } from '@/domain/rules'
import { OPEN_STATUSES } from '@/domain/statuses'
import type { DeviceKind, WarrantyCase } from '@/domain/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, NativeSelect, SubmitButton } from '@/components/form-kit'
import { Guard, PageShell, Section } from '@/components/woms'
import { AccessoryPicker } from '@/features/cases/actions'
import { PhotoPicker } from '@/features/cases/photo-picker'

// S-20 Tạo phiếu tiếp nhận (UC-02, FR-01, BR-01..03, EX-13).
export function IntakeCreate() {
  return (
    <Guard page='intake'>
      <Intake />
    </Guard>
  )
}

const PHONE = /^0\d{9}$/

function Intake() {
  const db = useDb()
  const me = useMe()
  const key = useRef(crypto.randomUUID())
  const [phone, setPhone] = useState('')
  const [looked, setLooked] = useState<'found' | 'new' | null>(null)
  const [customerId, setCustomerId] = useState<string>()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [kind, setKind] = useState<DeviceKind | ''>('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [serial, setSerial] = useState('')
  const [symptom, setSymptom] = useState('')
  const [condition, setCondition] = useState('')
  const [acc, setAcc] = useState<string[]>([])
  const [none, setNone] = useState(false)
  const [photos, setPhotos] = useState<File[]>([])
  const [tried, setTried] = useState(false)
  const [created, setCreated] = useState<WarrantyCase | null>(null)
  const m = useAction(api.createCase)

  const devices = db.devices.filter((d) => d.customerId === customerId)
  const dup = serial.trim() && db.cases.find((c) => OPEN_STATUSES.includes(c.status) && db.devices.find((d) => d.id === c.deviceId)?.serial.toUpperCase() === serial.trim().toUpperCase())

  function find() {
    if (!PHONE.test(phone)) {
      setTried(true)
      return
    }
    const cu = db.customers.find((c) => c.phone === phone)
    setLooked(cu ? 'found' : 'new')
    setCustomerId(cu?.id)
    setName(cu?.name ?? '')
    setEmail(cu?.email ?? '')
    setDeviceId('')
  }

  function pickDevice(id: string) {
    setDeviceId(id)
    const d = db.devices.find((x) => x.id === id)
    setKind(d?.kind ?? '')
    setBrand(d?.brand ?? '')
    setModel(d?.model ?? '')
    setSerial(d?.serial ?? '')
  }

  const errs = {
    phone: !PHONE.test(phone) && 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.',
    name: !name.trim() && 'Nhập họ tên khách.',
    email: !!email && !/^\S+@\S+\.\S+$/.test(email) && 'Email chưa đúng định dạng.',
    kind: !kind && 'Chọn loại thiết bị.',
    brand: !brand.trim() && 'Nhập hãng.',
    model: !model.trim() && 'Nhập model.',
    serial: serial.trim().length < 4 && 'Nhập serial in trên tem thiết bị.',
    symptom: symptom.trim().length < 10 && 'Mô tả lỗi khách báo, ít nhất 10 ký tự.',
    condition: !condition.trim() && 'Mô tả tình trạng bên ngoài, ghi "Nguyên vẹn" nếu không có vết.',
    acc: !none && acc.length === 0 && 'Chọn phụ kiện hoặc "Không có phụ kiện".',
    photos: photos.length === 0 && 'Chụp ít nhất 1 ảnh hiện trạng.',
  }
  const missing = Object.entries(errs).filter(([, v]) => v)
  const checks: [string, boolean][] = [
    ['Khách hàng', !errs.phone && !errs.name && !errs.email],
    ['Thiết bị và serial', !errs.kind && !errs.brand && !errs.model && !errs.serial],
    ['Lỗi khách mô tả', !errs.symptom],
    ['Tình trạng bên ngoài', !errs.condition],
    ['Phụ kiện', !errs.acc],
    ['Ảnh hiện trạng', !errs.photos],
  ]

  function submit() {
    setTried(true)
    if (missing.length) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    m.mutate(
      [
        me,
        {
          customerId,
          customer: { name: name.trim(), phone, email: email || undefined },
          deviceId: deviceId || undefined,
          device: { kind: kind as DeviceKind, brand: brand.trim(), model: model.trim(), serial: serial.trim() },
          symptom: symptom.trim(),
          condition: condition.trim(),
          accessories: acc,
          noAccessories: none,
          photos: photos.map((f) => f.name),
        },
        key.current,
      ],
      { onSuccess: (c) => setCreated(c as WarrantyCase) }
    )
  }

  if (created)
    return (
      <PageShell title={`Đã tạo phiếu ${created.code}`} crumbs={[{ label: 'Tạo phiếu tiếp nhận' }]}>
        <Section title='Biên nhận'>
          <div className='grid gap-4'>
            <p className='text-sm'>Trạng thái: Đã tiếp nhận. Phiếu đã chuyển vào hàng chờ kiểm tra sơ bộ của CSKH. Giao biên nhận cho khách, ghi rõ mã phiếu để tra cứu trên Customer Portal.</p>
            <div className='flex flex-wrap gap-2'>
              <Button onClick={() => window.print()}>In biên nhận</Button>
              <Button variant='outline' asChild>
                <Link to='/phieu/$id' params={{ id: created.id }}>
                  Mở phiếu
                </Link>
              </Button>
              <Button
                variant='outline'
                onClick={() => {
                  key.current = crypto.randomUUID()
                  window.location.reload()
                }}
              >
                Tạo phiếu khác
              </Button>
            </div>
          </div>
        </Section>
      </PageShell>
    )

  const show = (e: string | false) => tried && e

  return (
    <PageShell title='Tạo phiếu tiếp nhận' crumbs={[{ label: 'Tiếp nhận' }]}>
      {tried && missing.length > 0 && (
        <Alert variant='destructive'>
          <AlertTriangle />
          <AlertTitle>Phiếu còn thiếu {missing.length} thông tin bắt buộc</AlertTitle>
          <AlertDescription>Các ô cần bổ sung đã được đánh dấu đỏ bên dưới. Không lưu phiếu khi thiếu thông tin (BR-02).</AlertDescription>
        </Alert>
      )}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start'
      >
        <div className='grid gap-6'>
          <Section title='Khách hàng' description='Tìm theo số điện thoại. Không tra cứu khách chỉ bằng serial (BR-11).'>
            <div className='grid gap-4'>
              <div className='flex flex-wrap items-start gap-2'>
                <Field label='Số điện thoại' required error={show(errs.phone)} className='w-full max-w-72'>
                  {(id, d) => (
                    <Input
                      id={id}
                      aria-describedby={d}
                      aria-invalid={!!show(errs.phone)}
                      inputMode='tel'
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                        setLooked(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          find()
                        }
                      }}
                      placeholder='0912345678'
                    />
                  )}
                </Field>
                <Button type='button' variant='outline' className='mt-[22px]' onClick={find}>
                  Tìm khách
                </Button>
              </div>
              {looked && <p className='text-muted-foreground text-sm'>{looked === 'found' ? `Khách cũ, có ${db.cases.filter((c) => c.customerId === customerId).length} phiếu trước đây. Thông tin đã điền sẵn.` : 'Chưa có khách với số này. Nhập thông tin để tạo hồ sơ khách mới.'}</p>}
              <div className='grid gap-4 sm:grid-cols-2'>
                <Field label='Họ tên khách' required error={show(errs.name)}>
                  {(id, d) => <Input id={id} aria-describedby={d} value={name} onChange={(e) => setName(e.target.value)} />}
                </Field>
                <Field label='Email' error={show(errs.email)} hint='Không bắt buộc. Dùng để gửi thông báo tiến độ.'>
                  {(id, d) => <Input id={id} aria-describedby={d} type='email' value={email} onChange={(e) => setEmail(e.target.value)} />}
                </Field>
              </div>
            </div>
          </Section>

          <Section title='Thiết bị' description='Ghi đúng serial in trên tem thiết bị.'>
            <div className='grid gap-4'>
              {devices.length > 0 && (
                <Field label='Thiết bị đã đăng ký của khách'>
                  {(id) => (
                    <NativeSelect id={id} value={deviceId} onChange={(e) => pickDevice(e.target.value)}>
                      <option value=''>Thiết bị mới</option>
                      {devices.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.brand} {d.model} · {d.serial}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </Field>
              )}
              <div className='grid gap-4 sm:grid-cols-2'>
                <Field label='Loại thiết bị' required error={show(errs.kind)}>
                  {(id) => (
                    <NativeSelect id={id} value={kind} disabled={!!deviceId} onChange={(e) => setKind(e.target.value as DeviceKind)}>
                      <option value=''>Chọn loại</option>
                      {Object.entries(DEVICE_KIND_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </Field>
                <Field label='Hãng' required error={show(errs.brand)}>
                  {(id) => <Input id={id} value={brand} disabled={!!deviceId} onChange={(e) => setBrand(e.target.value)} placeholder='Dell, HP, Canon...' />}
                </Field>
                <Field label='Model' required error={show(errs.model)}>
                  {(id) => <Input id={id} value={model} disabled={!!deviceId} onChange={(e) => setModel(e.target.value)} placeholder='Latitude 5420' />}
                </Field>
                <Field label='Serial' required error={show(errs.serial)}>
                  {(id) => <Input id={id} value={serial} disabled={!!deviceId} className='font-mono uppercase' onChange={(e) => setSerial(e.target.value)} />}
                </Field>
              </div>
              {dup && (
                <Alert>
                  <AlertTriangle />
                  <AlertTitle>Serial này đang có phiếu chưa đóng</AlertTitle>
                  <AlertDescription>
                    <p>Kiểm tra phiếu {dup.code} trước khi tạo phiếu mới để tránh ghi trùng (BR-03). Nếu là lần bảo hành khác thì vẫn tạo được.</p>
                    <Link to='/phieu/$id' params={{ id: dup.id }} className='underline underline-offset-2'>
                      Mở phiếu {dup.code}
                    </Link>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </Section>

          <Section title='Lỗi khách mô tả'>
            <Field label='Khách báo lỗi gì' required error={show(errs.symptom)} hint='Ghi theo lời khách, chưa phải kết luận kỹ thuật.'>
              {(id, d) => <Textarea id={id} aria-describedby={d} rows={3} value={symptom} onChange={(e) => setSymptom(e.target.value)} placeholder='Máy không lên nguồn sau khi sạc qua đêm...' />}
            </Field>
          </Section>

          <Section title='Tình trạng, phụ kiện và ảnh' description='Dùng để đối chiếu khi bàn giao, tránh tranh chấp (IS-02).'>
            <div className='grid gap-5'>
              <Field label='Tình trạng bên ngoài' required error={show(errs.condition)}>
                {(id) => <Textarea id={id} rows={2} value={condition} onChange={(e) => setCondition(e.target.value)} placeholder='Trầy góc trái nắp máy, bàn phím đủ phím.' />}
              </Field>
              <AccessoryPicker value={acc} onChange={setAcc} none={none} onNone={setNone} error={show(errs.acc)} />
              <PhotoPicker files={photos} onChange={setPhotos} error={show(errs.photos)} />
            </div>
          </Section>
        </div>

        <aside className='bg-card grid gap-4 rounded-lg border p-4 lg:sticky lg:top-20'>
          <div>
            <h2 className='font-semibold'>Kiểm tra trước khi tạo</h2>
            <p className='text-muted-foreground text-sm'>
              Đủ {checks.filter(([, ok]) => ok).length}/{checks.length} mục bắt buộc
            </p>
          </div>
          <ul className='grid gap-2 text-sm'>
            {checks.map(([l, ok]) => (
              <li key={l} className='flex items-center gap-2'>
                {ok ? <Check className='size-4 text-emerald-600' aria-hidden /> : <Circle className='text-muted-foreground size-4' aria-hidden />}
                <span className={ok ? '' : 'text-muted-foreground'}>{l}</span>
                <span className='sr-only'>{ok ? 'đã đủ' : 'còn thiếu'}</span>
              </li>
            ))}
          </ul>
          <SubmitButton type='submit' pending={m.isPending} pendingText='Đang tạo phiếu...'>
            Tạo phiếu tiếp nhận
          </SubmitButton>
          <p className='text-muted-foreground text-xs'>Không thu mật khẩu máy của khách. Mã phiếu dạng CAS-YYYYMMDD-XXXX.</p>
        </aside>
      </form>
    </PageShell>
  )
}
