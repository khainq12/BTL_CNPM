import { PUBLIC_STEPS } from '@woms/domain'
import { useState, type FormEvent } from 'react'
import { DEMO_OTP, errorText, isDemo, lookup, respondQuote, type LookupResult } from '../api'
import { formatMoney, formatTime } from '../format'

// Tra cứu tiến độ (TV7-01..06). Giữ cách làm của bản mẫu TV7: cần cả mã phiếu và số điện thoại, sai quá 5 lần thì hỏi
// câu xác nhận; máy chủ còn giới hạn số lần gọi theo IP.
export const MAX_FAILED_LOOKUPS = 5
const newCaptcha = () => ({ a: 2 + Math.floor(Math.random() * 7), b: 2 + Math.floor(Math.random() * 7) })

export default function Lookup() {
  const [code, setCode] = useState('')
  const [phone, setPhone] = useState('')
  const [fails, setFails] = useState(0)
  const [captcha, setCaptcha] = useState(newCaptcha)
  const [answer, setAnswer] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [data, setData] = useState<LookupResult | null>(null)
  const [auth, setAuth] = useState<{ code: string; phone: string } | null>(null)

  const open = async (c: string, p: string) => {
    const r = await lookup(c, p)
    setData(r)
    setAuth({ code: r.case.code, phone: p })
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (fails >= MAX_FAILED_LOOKUPS && Number(answer) !== captcha.a + captcha.b) {
      setMsg('Kết quả phép cộng chưa đúng.')
      setCaptcha(newCaptcha())
      return
    }
    setBusy(true)
    setMsg('')
    try {
      await open(code, phone)
      setFails(0)
      setAnswer('')
    } catch (err) {
      const n = fails + 1
      setFails(n)
      setMsg(errorText(err))
      if (n >= MAX_FAILED_LOOKUPS) setCaptcha(newCaptcha())
    } finally {
      setBusy(false)
    }
  }

  if (data && auth)
    return (
      <CaseView
        data={data}
        auth={auth}
        reload={() => open(auth.code, auth.phone)}
        openOther={(c) => open(c, auth.phone)}
        back={() => {
          setData(null)
          setAuth(null)
        }}
      />
    )

  return (
    <section className="card">
      <h2>Tra cứu phiếu bảo hành</h2>
      <p className="mut">Nhập mã phiếu trên biên nhận và số điện thoại đã đăng ký khi gửi thiết bị.</p>
      <form className="row" onSubmit={submit} aria-label="Tra cứu phiếu">
        <label>
          Mã phiếu
          <input name="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="CAS-YYYYMMDD-XXXX" autoComplete="off" required />
        </label>
        <label>
          Số điện thoại
          <input name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" required />
        </label>
        {fails >= MAX_FAILED_LOOKUPS && (
          <label>
            Xác nhận bạn không phải máy: {captcha.a} + {captcha.b} =
            <input name="captcha" value={answer} onChange={(e) => setAnswer(e.target.value)} inputMode="numeric" />
          </label>
        )}
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Đang tra cứu…' : 'Tra cứu'}
        </button>
      </form>
      <p className="msg" role="alert">
        {msg}
      </p>
      {isDemo && (
        <p className="mut">
          <small>Bản thử (không kết nối máy chủ). Dữ liệu mẫu: CAS-20261106-0041 / 0912345678.</small>
        </p>
      )}
    </section>
  )
}

function CaseView({ data, auth, reload, openOther, back }: { data: LookupResult; auth: { code: string; phone: string }; reload: () => Promise<void>; openOther: (code: string) => Promise<void>; back: () => void }) {
  const v = data.case
  const [otpMode, setOtpMode] = useState<null | boolean>(null)
  const [otp, setOtp] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const answer = async (accepted: boolean) => {
    setBusy(true)
    setMsg('')
    try {
      await respondQuote(auth.code, auth.phone, otp, accepted)
      setOtpMode(null)
      setOtp('')
      await reload()
    } catch (e) {
      setMsg(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <section className="card" aria-label="Thông tin phiếu">
        <div className="row spread">
          <div>
            <h2 data-testid="case-code">{v.code}</h2>
            <div>{v.device}</div>
            <small>
              Lỗi khai báo: {v.symptom}. Gửi lúc {formatTime(v.createdAt)}
            </small>
          </div>
          <button className="btn s" onClick={back}>
            Tra cứu phiếu khác
          </button>
        </div>

        <ol className="rail" aria-label="Tiến độ">
          {PUBLIC_STEPS.map((name, i) => (
            <li key={name} className={v.final || i < v.step ? 'done' : i === v.step ? 'cur' : ''} aria-current={i === v.step ? 'step' : undefined}>
              <i />
              {name}
            </li>
          ))}
        </ol>

        <p className="strong" data-testid="current-step">
          Bước hiện tại: {v.stepLabel}
        </p>
        {v.note && <div className="note">{v.note}</div>}
        {v.eta.message && (
          <p className="mut">
            {v.eta.message} {v.eta.dueAt && <b>{formatTime(v.eta.dueAt)}</b>}
          </p>
        )}

        {v.quote && (
          <div className="note" data-testid="quote">
            <b>Báo giá sửa chữa (lần {v.quote.version}): {formatMoney(v.quote.total)}</b>
            <ul className="l">
              {v.quote.items.map((i, k) => (
                <li key={k}>
                  {i.label} × {i.qty}: {formatMoney(i.qty * i.unitPrice)}
                </li>
              ))}
              {v.quote.labor > 0 && <li>Tiền công: {formatMoney(v.quote.labor)}</li>}
            </ul>
            <p className="tight">Trung tâm chỉ sửa khi bạn đồng ý. Xác nhận bằng mã OTP gửi tới số điện thoại đã đăng ký.</p>
            {otpMode === null ? (
              <div className="row">
                <button className="btn" onClick={() => setOtpMode(true)}>
                  Đồng ý sửa
                </button>
                <button className="btn s" onClick={() => setOtpMode(false)}>
                  Từ chối
                </button>
              </div>
            ) : (
              <div className="row">
                <label>
                  Mã OTP{isDemo || import.meta.env.DEV ? ` (bản thử: ${DEMO_OTP})` : ''}
                  <input name="otp" value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" autoComplete="one-time-code" />
                </label>
                <button className="btn" disabled={busy || !otp} onClick={() => answer(otpMode)}>
                  {otpMode ? 'Xác nhận đồng ý' : 'Xác nhận từ chối'}
                </button>
                <button className="btn s" onClick={() => setOtpMode(null)}>
                  Hủy
                </button>
              </div>
            )}
            <p className="msg" role="alert">
              {msg}
            </p>
          </div>
        )}
      </section>

      <div className="two">
        <section className="card">
          <h2>Tiến độ theo thời gian</h2>
          <ul className="l" data-testid="timeline">
            {[...v.timeline].reverse().map((e) => (
              <li key={`${e.step}-${e.at}`}>
                <time>{formatTime(e.at)}</time> · {e.label}
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <h2>Thông báo</h2>
          {data.notifications.length ? (
            <ul className="l">
              {data.notifications.map((n) => (
                <li key={`${n.at}-${n.text}`}>
                  <time>{formatTime(n.at)}</time> · {n.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mut">Chưa có thông báo.</p>
          )}
          <small>Thông báo được gửi qua SMS khi tiến độ thay đổi.</small>
        </section>
      </div>

      <section className="card">
        <h2>Các phiếu khác của bạn</h2>
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Mã phiếu</th>
                <th>Thiết bị</th>
                <th>Gửi lúc</th>
                <th>Tiến độ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.history.map((x) => (
                <tr key={x.code}>
                  <td>{x.code}</td>
                  <td>{x.device}</td>
                  <td>{formatTime(x.createdAt)}</td>
                  <td>{x.stepLabel}</td>
                  <td>
                    {x.code === v.code ? (
                      <small>Đang xem</small>
                    ) : (
                      <button className="btn s" onClick={() => openOther(x.code)}>
                        Xem
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
