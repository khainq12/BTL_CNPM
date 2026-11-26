import { useState, type FormEvent } from 'react';
import { api } from '../api';
import type { CaptchaChallenge, PortalCaseView } from '../api/contract';
import { useApp } from '../AppState';
import { PUBLIC_STEPS, STATUS_LABEL } from '../constants';
import { formatMoney, formatTime } from '../format';
import { errorMessage, useAsync } from '../hooks';

interface Session { token: string; code: string; first: PortalCaseView | null }

const formatDate = (t: number) => new Date(t).toLocaleDateString('vi-VN');
const LOOKUP_MSG = {
  NOT_FOUND: 'Không tìm thấy phiếu phù hợp. Kiểm tra lại mã phiếu và số điện thoại.',
  CAPTCHA_REQUIRED: 'Vui lòng trả lời câu hỏi xác nhận bên dưới.',
  CAPTCHA_WRONG: 'Kết quả phép cộng chưa đúng.',
} as const;

export default function PortalPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [challenge, setChallenge] = useState<CaptchaChallenge | null>(null);
  const [answer, setAnswer] = useState('');
  const [msg, setMsg] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const r = await api.lookup({ code, phone, captcha: challenge ? { id: challenge.id, answer } : undefined });
      if (r.ok) {
        setChallenge(null); setAnswer(''); setMsg('');
        setSession({ token: r.session, code: r.view.case.code, first: r.view });
      } else {
        setMsg(LOOKUP_MSG[r.reason]);
        setChallenge(r.challenge ?? null);
        setAnswer('');
      }
    } catch (err) {
      setMsg(errorMessage(err));
    }
  };

  if (session) {
    return (
      <CaseView key={session.code} session={session} onBack={() => setSession(null)}
        onOpen={(c) => setSession({ token: session.token, code: c, first: null })} />
    );
  }

  return (
    <section className="card">
      <h2>Tra cứu phiếu bảo hành</h2>
      <p className="mut">Nhập mã phiếu trên biên nhận và số điện thoại đã đăng ký khi gửi thiết bị.</p>
      <form className="row" onSubmit={submit}>
        <label>Mã phiếu<input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CAS-YYYYMMDD-XXXX" autoComplete="off" /></label>
        <label>Số điện thoại<input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" /></label>
        {challenge && (
          <label>Xác nhận bạn không phải máy: {challenge.prompt}
            <input value={answer} onChange={(e) => setAnswer(e.target.value)} inputMode="numeric" />
          </label>
        )}
        <button className="btn" type="submit">Tra cứu</button>
      </form>
      <p className="msg" role="alert">{msg}</p>
      {api.dev && (
        <p className="mut"><small>
          Dữ liệu mẫu: CAS-20261109-0001 / 0912345678 (thiết bị đã có 1 lần sửa trước, còn bảo hành sau sửa chữa).
          CAS-20261111-0006 / 0944556677 (báo giá đã gửi, chờ xác nhận).
          CAS-20261111-0010 / 0977889900 (báo giá đang chờ quản lý duyệt, khách chưa thấy số tiền).
          Sai quá 5 lần sẽ hiện câu hỏi xác nhận.
        </small></p>
      )}
    </section>
  );
}

function CaseView({ session, onOpen, onBack }: { session: Session; onOpen: (code: string) => void; onBack: () => void }) {
  const { version, refresh } = useApp();
  const [otpMode, setOtpMode] = useState(false);
  const [otp, setOtp] = useState('');
  const [demoOtp, setDemoOtp] = useState<string | undefined>(undefined);
  const [msg, setMsg] = useState('');

  const loaded = useAsync(() => api.openCase(session.token, session.code), [session.token, session.code, version], session.first);
  const data = loaded.data;
  if (!data) return <section className="card"><p className="mut">{loaded.error ?? 'Đang tải…'}</p></section>;

  const v = data.case;

  const startOtp = async () => {
    try {
      const r = await api.requestQuoteOtp(session.token, v.code);
      setDemoOtp(r.demoOtp); setOtpMode(true); setMsg('');
    } catch (e) { setMsg(errorMessage(e)); }
  };
  const respond = async (accept: boolean) => {
    try {
      await api.respondQuote(session.token, v.code, { accept, otp: accept ? otp : undefined });
      setOtpMode(false); setOtp(''); setMsg('');
      refresh();
    } catch (e) { setMsg(errorMessage(e)); }
  };

  return (
    <>
      <section className="card">
        <div className="row spread">
          <div>
            <h2>{v.code}</h2>
            <div>{v.device}</div>
            <small>Serial: {v.serial}. Lỗi khai báo: {v.symptom}. Tiếp nhận lúc {formatTime(v.receivedAt)}</small>
          </div>
          <button className="btn s" onClick={onBack}>Tra cứu phiếu khác</button>
        </div>

        <ol className="rail">
          {PUBLIC_STEPS.map((name, i) => (
            <li key={name} className={v.closed || i < v.step ? 'done' : i === v.step ? 'cur' : ''}><i />{name}</li>
          ))}
        </ol>

        {v.note && <div className="note">{v.note}</div>}
        {data.eta.message && <p className="mut">{data.eta.message} {data.eta.deadline !== null && formatTime(data.eta.deadline)}</p>}

        {v.quote && (
          <div className="note">
            <b>Báo giá sửa chữa</b>
            <table className="quote">
              <tbody>
                <tr><td>Chi phí linh kiện</td><td>{formatMoney(v.quote.parts)}</td></tr>
                <tr><td>Tiền công</td><td>{formatMoney(v.quote.labor)}</td></tr>
                <tr className="total"><td>Tổng chi phí</td><td>{formatMoney(v.quote.total)}</td></tr>
              </tbody>
            </table>
            <p className="tight">Thiết bị hết điều kiện bảo hành miễn phí. Chỉ sửa khi bạn đồng ý.</p>
            {otpMode ? (
              <div className="row">
                <label>Mã OTP{demoOtp ? ` (mẫu: ${demoOtp})` : ''}<input value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" /></label>
                <button className="btn" onClick={() => respond(true)}>Xác nhận đồng ý</button>
              </div>
            ) : (
              <div className="row">
                <button className="btn" onClick={startOtp}>Đồng ý sửa</button>
                <button className="btn s" onClick={() => respond(false)}>Từ chối</button>
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
          <ul className="l">{data.notifications.map((n) => <li key={`${n.at}-${n.text}`}><time>{formatTime(n.at)}</time>{n.text}</li>)}</ul>
          <small>Thông báo cũng được gửi qua SMS hoặc email khi trạng thái thay đổi.</small>
        </section>
      </div>

      <section className="card">
        <h2>Lịch sử bảo hành, sửa chữa của thiết bị này</h2>
        <div className="tw">
          <table>
            <thead><tr><th>Mã phiếu</th><th>Tiếp nhận</th><th>Trạng thái</th><th>Linh kiện đã thay</th><th>Bảo hành sau sửa chữa đến</th></tr></thead>
            <tbody>
              {data.history.map((h) => (
                <tr key={h.code}>
                  <td>{h.code}{h.code === v.code && <small> (đang xem)</small>}</td>
                  <td>{formatTime(h.receivedAt)}</td>
                  <td>{STATUS_LABEL[h.status]}</td>
                  <td>{h.parts.length ? h.parts.map((p) => `${p.name} × ${p.qty}`).join(', ') : '—'}</td>
                  <td>{h.warrantyUntil !== null ? formatDate(h.warrantyUntil) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {data.otherDevices.length > 0 && (
        <section className="card">
          <h2>Thiết bị khác của số điện thoại này</h2>
          <div className="tw">
            <table>
              <thead><tr><th>Mã phiếu</th><th>Thiết bị</th><th>Tiếp nhận</th><th>Trạng thái</th><th /></tr></thead>
              <tbody>
                {data.otherDevices.map((x) => (
                  <tr key={x.code}>
                    <td>{x.code}</td><td>{x.device}</td><td>{formatTime(x.receivedAt)}</td><td>{STATUS_LABEL[x.status]}</td>
                    <td><button className="btn s" onClick={() => onOpen(x.code)}>Xem</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
