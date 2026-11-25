import { useState, type FormEvent } from 'react'
import { errorText, submitRequest, type RequestInput } from '../api'

// Khách gửi yêu cầu bảo hành trực tuyến (DRAFT → PENDING_ACCEPT, màn S-21 của nhân viên tiếp nhận nhận tiếp).
// randomUUID chỉ có trong secure context (https/localhost).
const newKey = () => ('randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)

const empty: RequestInput = { customer: { name: '', phone: '', email: '' }, device: { kind: 'laptop', brand: '', model: '', serial: '', purchaseDate: '' }, symptom: '' }

export default function Request() {
  const [f, setF] = useState<RequestInput>(empty)
  const [key, setKey] = useState(newKey)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [done, setDone] = useState<{ code: string; message: string } | null>(null)

  const set = (path: 'customer' | 'device', k: string, v: string) => setF((x) => ({ ...x, [path]: { ...x[path], [k]: v } }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    try {
      const body: RequestInput = { ...f, device: { ...f.device, purchaseDate: f.device.purchaseDate ? new Date(f.device.purchaseDate).toISOString() : undefined }, customer: { ...f.customer, email: f.customer.email || undefined } }
      setDone(await submitRequest(body, key))
    } catch (err) {
      setMsg(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  if (done)
    return (
      <section className="card" aria-live="polite">
        <h2>Đã gửi yêu cầu</h2>
        <p>
          Mã phiếu của bạn: <b data-testid="new-code">{done.code}</b>
        </p>
        <p className="mut">{done.message}</p>
        <button
          className="btn s"
          onClick={() => {
            setDone(null)
            setF(empty)
            setKey(newKey())
          }}
        >
          Gửi yêu cầu khác
        </button>
      </section>
    )

  return (
    <section className="card">
      <h2>Gửi yêu cầu bảo hành</h2>
      <p className="mut">Khai báo trước để rút ngắn thời gian tiếp nhận tại quầy. Trung tâm lập biên nhận khi bạn mang thiết bị tới.</p>
      <form onSubmit={submit} aria-label="Gửi yêu cầu bảo hành">
        <h3>Thông tin liên hệ</h3>
        <div className="row">
          <label>
            Họ tên
            <input name="name" value={f.customer.name} onChange={(e) => set('customer', 'name', e.target.value)} required autoComplete="name" />
          </label>
          <label>
            Số điện thoại
            <input name="phone" value={f.customer.phone} onChange={(e) => set('customer', 'phone', e.target.value)} required inputMode="tel" autoComplete="tel" />
          </label>
          <label>
            Email (không bắt buộc)
            <input name="email" type="email" value={f.customer.email} onChange={(e) => set('customer', 'email', e.target.value)} autoComplete="email" />
          </label>
        </div>
        <h3>Thiết bị</h3>
        <div className="row">
          <label>
            Loại
            <select name="kind" value={f.device.kind} onChange={(e) => set('device', 'kind', e.target.value)}>
              <option value="laptop">Laptop</option>
              <option value="pc">Máy tính để bàn</option>
              <option value="printer">Máy in</option>
            </select>
          </label>
          <label>
            Hãng
            <input name="brand" value={f.device.brand} onChange={(e) => set('device', 'brand', e.target.value)} required />
          </label>
          <label>
            Model
            <input name="model" value={f.device.model} onChange={(e) => set('device', 'model', e.target.value)} required />
          </label>
          <label>
            Serial (in trên tem)
            <input name="serial" value={f.device.serial} onChange={(e) => set('device', 'serial', e.target.value)} required />
          </label>
          <label>
            Ngày mua (nếu nhớ)
            <input name="purchaseDate" type="date" value={f.device.purchaseDate} onChange={(e) => set('device', 'purchaseDate', e.target.value)} />
          </label>
        </div>
        <label className="field">
          Mô tả lỗi
          <textarea name="symptom" rows={3} value={f.symptom} onChange={(e) => setF((x) => ({ ...x, symptom: e.target.value }))} required />
        </label>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Đang gửi…' : 'Gửi yêu cầu'}
        </button>
        <p className="msg" role="alert">
          {msg}
        </p>
      </form>
    </section>
  )
}
