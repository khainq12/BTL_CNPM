import { useState, type FormEvent } from 'react';
import { FINAL_STATUSES, PUBLIC_STEPS, STATUS_LABEL } from '../constants';
import { formatMoney, formatTime } from '../format';
import {
  DEMO_OTP, MAX_FAILED_LOOKUPS, buildNotifications, casesOfPhone, findCase, publicEta, toPublicCase,
} from '../services/portalService';
import { useStore } from '../store';

interface Session { code: string; phone: string }

const newCaptcha = () => ({ a: 2 + Math.floor(Math.random() * 7), b: 2 + Math.floor(Math.random() * 7) });

export default function PortalPage() {
  const { cases } = useStore();
  const [session, setSession] = useState<Session | null>(null);
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [fails, setFails] = useState(0);
  const [captcha, setCaptcha] = useState(newCaptcha);
  const [answer, setAnswer] = useState('');
  const [msg, setMsg] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (fails >= MAX_FAILED_LOOKUPS && Number(answer) !== captcha.a + captcha.b) {
      setMsg('Kết quả phép cộng chưa đúng.');
      setCaptcha(newCaptcha());
      return;
    }
    const found = findCase(cases, code, phone);
    if (!found) {
      const n = fails + 1;
      setFails(n);
      setMsg('Không tìm thấy phiếu phù hợp. Kiểm tra lại mã phiếu và số điện thoại.');
      if (n >= MAX_FAILED_LOOKUPS) setCaptcha(newCaptcha());
      return;
    }
    setFails(0);
    setMsg('');
    setAnswer('');
    setSession({ code: found.code, phone: found.phone });
  };

  if (session) return <CaseView session={session} onOpen={(c) => setSession({ ...session, code: c })} onBack={() => setSession(null)} />;

  return (
    <section className="card">
      <h2>Tra cứu phiếu bảo hành</h2>
      <p className="mut">Nhập mã phiếu trên biên nhận và số điện thoại đã đăng ký khi gửi thiết bị.</p>
      <form className="row" onSubmit={submit}>
        <label>Mã phiếu<input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CAS-YYYYMMDD-XXXX" autoComplete="off" /></label>
        <label>Số điện thoại<input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" /></label>
        {fails >= MAX_FAILED_LOOKUPS && (
          <label>Xác nhận bạn không phải máy: {captcha.a} + {captcha.b} =
            <input value={answer} onChange={(e) => setAnswer(e.target.value)} inputMode="numeric" />
          </label>
        )}
        <button className="btn" type="submit">Tra cứu</button>
      </form>
      <p className="msg" role="alert">{msg}</p>
      <p className="mut"><small>
        Dữ liệu mẫu: CAS-20261109-0001 / 0912345678 (có 2 lần bảo hành cũ). CAS-20261111-0006 / 0944556677 (đang chờ xác nhận báo giá).
        Sai quá {MAX_FAILED_LOOKUPS} lần sẽ hiện câu hỏi xác nhận.
      </small></p>
    </section>
  );
}

function CaseView({ session, onOpen, onBack }: { session: Session; onOpen: (code: string) => void; onBack: () => void }) {
  const { cases, now, calendar, warnRatio, answerQuote } = useStore();
  const [otpMode, setOtpMode] = useState(false);
  const [otp, setOtp] = useState('');
  const [msg, setMsg] = useState('');

  const c = cases.find((x) => x.code === session.code);
  if (!c) return null;
  const v = toPublicCase(c);
  const final = FINAL_STATUSES.includes(c.status);
  const eta = publicEta(c, now, calendar, warnRatio);
  const mine = casesOfPhone(cases, session.phone);
  const notes = buildNotifications(cases, session.phone);

  const confirm = () => {
    if (otp !== DEMO_OTP) { setMsg('Mã OTP chưa đúng.'); return; }
    answerQuote(c.code, true);
    setOtpMode(false); setOtp(''); setMsg('');
  };

  return (
    <>
      <section className="card">
        <div className="row spread">
          <div>
            <h2>{v.code}</h2>
            <div>{v.device}</div>
            <small>Lỗi khai báo: {v.symptom}. Tiếp nhận lúc {formatTime(v.receivedAt)}</small>
          </div>
          <button className="btn s" onClick={onBack}>Tra cứu phiếu khác</button>
        </div>

        <ol className="rail">
          {PUBLIC_STEPS.map((name, i) => (
            <li key={name} className={final || i < v.step ? 'done' : i === v.step ? 'cur' : ''}><i />{name}</li>
          ))}
        </ol>

        {v.note && <div className="note">{v.note}</div>}
        {eta.message && <p className="mut">{eta.message} {eta.deadline !== null && formatTime(eta.deadline)}</p>}

        {v.quote > 0 && (
          <div className="note">
            <b>Báo giá sửa chữa: {formatMoney(v.quote)}</b>
            <p className="tight">Thiết bị hết điều kiện bảo hành miễn phí. Chỉ sửa khi bạn đồng ý.</p>
            {otpMode ? (
              <div className="row">
                <label>Mã OTP (mẫu: {DEMO_OTP})<input value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" /></label>
                <button className="btn" onClick={confirm}>Xác nhận đồng ý</button>
              </div>
            ) : (
              <div className="row">
                <button className="btn" onClick={() => setOtpMode(true)}>Đồng ý sửa</button>
                <button className="btn s" onClick={() => answerQuote(c.code, false)}>Từ chối</button>
              </div>
            )}
            <p className="msg">{msg}</p>
          </div>
        )}
      </section>

      <div className="two">
        <section className="card">
          <h2>Tiến độ theo thời gian</h2>
          <ul className="l">
            {[...v.events].reverse().map((e) => <li key={`${e.step}-${e.at}`}><time>{formatTime(e.at)}</time>{PUBLIC_STEPS[e.step]}</li>)}
          </ul>
        </section>
        <section className="card">
          <h2>Thông báo</h2>
          <ul className="l">{notes.map((n) => <li key={`${n.at}-${n.text}`}><time>{formatTime(n.at)}</time>{n.text}</li>)}</ul>
          <small>Thông báo cũng được gửi qua SMS hoặc email khi trạng thái thay đổi.</small>
        </section>
      </div>

      <section className="card">
        <h2>Lịch sử bảo hành của số điện thoại này</h2>
        <div className="tw">
          <table>
            <thead><tr><th>Mã phiếu</th><th>Thiết bị</th><th>Tiếp nhận</th><th>Trạng thái</th><th /></tr></thead>
            <tbody>
              {mine.map((x) => (
                <tr key={x.code}>
                  <td>{x.code}</td><td>{x.device}</td><td>{formatTime(x.receivedAt)}</td><td>{STATUS_LABEL[x.status]}</td>
                  <td>{x.code === c.code ? <small>Đang xem</small> : <button className="btn s" onClick={() => onOpen(x.code)}>Xem</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
