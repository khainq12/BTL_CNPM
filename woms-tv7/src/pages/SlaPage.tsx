import { useState } from 'react';
import { api } from '../api';
import type { AlertView, SlaSettingsPatch } from '../api/contract';
import { useApp } from '../AppState';
import { PAUSE_CAP_DAYS, PAUSE_LABEL, STATUS_LABEL } from '../constants';
import { WEEKDAYS, formatDuration, formatTime, hhmmToMinutes, minutesToHHMM, toInputValue } from '../format';
import { errorMessage, useAsync } from '../hooks';
import { ALERT_LABEL, ROLE_LABEL, type AlertCommand } from '../sla/alerts';
import type { HistoryRow } from '../sla/engine';
import type { PauseKind, SlaCode, SlaState } from '../types';

const BADGE: Record<SlaState, [string, string]> = {
  OK: ['Đúng tiến độ', 'ok'], WARN: ['Sắp quá hạn', 'wn'], BREACH: ['Quá hạn', 'bad'],
  PAUSED: ['Tạm dừng', 'mut'], DONE: ['Hoàn tất đúng hạn', 'ok'], LATE: ['Hoàn tất trễ', 'bad'],
};
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const ALERT_TONE: Record<AlertView['status'], string> = { OPEN: 'bad', ESCALATED: 'wn', HANDLED: 'ok' };
const ALERT_STATUS_LABEL: Record<AlertView['status'], string> = { OPEN: 'Chưa xử lý', ESCALATED: 'Đã chuyển quản lý', HANDLED: 'Đã xử lý' };
const COMMAND_LABEL: Record<AlertCommand, string> = {
  COORDINATOR_DONE: 'Điều phối xử lý xong', ESCALATE: 'Chuyển quản lý', MANAGER_DONE: 'Quản lý xử lý xong', CSKH_DONE: 'CSKH đã liên hệ khách',
};

export default function SlaPage() {
  const { version, refresh, now } = useApp();
  const [selected, setSelected] = useState<string | null>(null);
  const [pauseKind, setPauseKind] = useState<Record<string, PauseKind>>({});
  const [calcStart, setCalcStart] = useState(() => toInputValue(now));
  const [calcHours, setCalcHours] = useState(16);
  const [error, setError] = useState('');

  const rows = useAsync(() => api.listSla(), [version]);
  const alerts = useAsync(() => api.listAlerts(), [version]);
  const settings = useAsync(() => api.getSettings(), [version]);
  const target = selected ?? rows.data?.[0]?.caseCode ?? null;
  const history = useAsync(() => (target ? api.getSlaHistory(target) : Promise.resolve<HistoryRow[]>([])), [target, version]);
  const startMs = new Date(calcStart).getTime();
  const calcValid = !isNaN(startMs) && calcHours > 0;
  const deadline = useAsync(() => (calcValid ? api.calculateDeadline(startMs, calcHours) : Promise.resolve<number | null>(null)), [calcStart, calcHours, version]);

  /** Gọi API, báo lỗi nếu có, rồi tải lại dữ liệu. */
  const run = async (fn: () => Promise<unknown>) => {
    try { await fn(); setError(''); } catch (e) { setError(errorMessage(e)); }
    refresh();
  };
  const patch = (p: SlaSettingsPatch) => run(() => api.updateSettings(p));

  const s = settings.data;
  const cal = s?.calendar;

  return (
    <>
      {error && <p className="msg" role="alert">{error}</p>}
      <section className="card">
        <h2>Theo dõi thời gian xử lý (TV7-09, 10, 11)</h2>
        <p className="mut">
          Mỗi phiếu hiển thị mốc SLA đang chạy. Cảnh báo từ {s ? Math.round(s.warnRatio * 100) : '…'}% thời hạn, vi phạm khi vượt 100%.
          {api.dev && ' Đổi “Giờ hệ thống mẫu” ở thanh trên để xem trạng thái thay đổi.'}
        </p>
        <div className="tw">
          <table>
            <thead><tr><th>Phiếu</th><th>Trạng thái phiếu</th><th>Mốc</th><th>Hạn</th><th>Còn lại</th><th>Đã dùng</th><th>SLA</th><th>Thao tác</th></tr></thead>
            <tbody>
              {!rows.data && <tr><td colSpan={8} className="mut">{rows.error ?? 'Đang tải…'}</td></tr>}
              {rows.data?.map((r) => {
                const [label, tone] = BADGE[r.state];
                const pct = Math.round(r.ratio * 100);
                const kind = pauseKind[r.caseCode] ?? r.pauseOptions[0];
                return (
                  <tr key={r.caseCode}>
                    <td>{r.caseCode}</td>
                    <td>{STATUS_LABEL[r.caseStatus]}</td>
                    <td>{r.slaCode}</td>
                    <td>{r.state === 'PAUSED' || r.deadline === null ? 'Tạm dừng' : formatTime(r.deadline)}</td>
                    <td>{r.ended ? '—' : formatDuration(r.remainingMinutes)}</td>
                    <td><div className={`bar ${tone}`}><i style={{ width: `${Math.min(100, pct)}%` }} /></div><small>{pct}%</small></td>
                    <td><span className={`b ${tone}`}>{label}</span>{r.pauseExpired && <small> hết hạn tạm dừng</small>}</td>
                    <td className="acts">
                      {!r.ended && (r.paused
                        ? <button className="btn s" onClick={() => run(() => api.resumeSla(r.caseCode))}>Tiếp tục</button>
                        : <>
                            {r.pauseOptions.length > 1 && (
                              <select value={kind} onChange={(e) => setPauseKind((m) => ({ ...m, [r.caseCode]: e.target.value as PauseKind }))}>
                                {r.pauseOptions.map((k) => <option key={k} value={k}>{PAUSE_LABEL[k]}</option>)}
                              </select>
                            )}
                            <button className="btn s" onClick={() => run(() => api.pauseSla(r.caseCode, kind))}>Tạm dừng</button>
                          </>)}
                      {!r.ended && <button className="btn s" onClick={() => run(() => api.finishSla(r.caseCode))}>Hoàn tất</button>}
                      <button className="btn s" onClick={() => setSelected(r.caseCode)}>Lịch sử</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Nhật ký cảnh báo (BR-25, FR-14)</h2>
        <p className="mut">Cảnh báo được sinh từ trạng thái SLA. Điều phối viên xử lý trước, vượt thẩm quyền thì chuyển quản lý. Cảnh báo của SLA đã hoàn tất hoặc linh kiện đã về tự đóng.</p>
        <div className="tw">
          <table>
            <thead><tr><th>Thời điểm</th><th>Phiếu</th><th>Loại</th><th>Gửi tới</th><th>Trạng thái</th><th>Kết quả xử lý</th><th>Thao tác</th></tr></thead>
            <tbody>
              {alerts.data?.length === 0 && <tr><td colSpan={7} className="mut">Chưa có cảnh báo nào.</td></tr>}
              {alerts.data?.map((a) => (
                <tr key={a.id}>
                  <td>{formatTime(a.raisedAt)}</td>
                  <td>{a.caseCode}{a.slaCode ? ` · ${a.slaCode}` : ''}</td>
                  <td>{ALERT_LABEL[a.kind]}</td>
                  <td>{a.recipients.map((r) => ROLE_LABEL[r]).join(', ')}</td>
                  <td><span className={`b ${ALERT_TONE[a.status]}`}>{ALERT_STATUS_LABEL[a.status]}</span></td>
                  <td>{a.result || '—'}</td>
                  <td className="acts">{a.commands.map((cmd) => <button key={cmd} className="btn s" onClick={() => run(() => api.actOnAlert(a.id, cmd))}>{COMMAND_LABEL[cmd]}</button>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {target && (
        <section className="card">
          <h2>Lịch sử SLA của {target} (TV7-12)</h2>
          <div className="tw">
            <table>
              <thead><tr><th>Thời điểm</th><th>Mốc</th><th>Sự kiện</th></tr></thead>
              <tbody>{history.data?.map((h, i) => <tr key={i}><td>{formatTime(h.at)}</td><td>{h.sla}</td><td>{h.text}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}

      {s && cal && (
        <div className="two">
          <section className="card">
            <h2>Chính sách SLA (TV7-07)</h2>
            {(Object.keys(s.policy) as SlaCode[]).map((k) => (
              <label key={k} className="field">
                {k} {s.policy[k].name}
                <span>
                  <input type="number" min={0.5} step={0.5} className="num" key={`${k}-${s.policy[k].hours}`} defaultValue={s.policy[k].hours}
                    onBlur={(e) => { const v = Number(e.target.value); if (v !== s.policy[k].hours) patch({ policyHours: { [k]: v } }); }} /> giờ làm việc
                </span>
              </label>
            ))}
            <small>Thay đổi chỉ áp dụng cho SLA tạo mới. Giá trị theo mục B.6 của SRS, chưa xác nhận thực địa.</small>
            <h3>Trần tạm dừng</h3>
            <small>{(Object.entries(PAUSE_CAP_DAYS) as Array<[PauseKind, number]>).map(([k, d]) => `${PAUSE_LABEL[k]}: tối đa ${d} ngày làm việc`).join('. ')}. Phần chờ vượt trần tính vào thời gian xử lý (BR-26).</small>
            <h3>Ngưỡng cảnh báo</h3>
            <label className="field"><span>
              <input type="number" min={1} max={99} className="num" key={`w-${s.warnRatio}`} defaultValue={Math.round(s.warnRatio * 100)}
                onBlur={(e) => { const v = Number(e.target.value) / 100; if (v !== s.warnRatio) patch({ warnRatio: v }); }} /> % thời hạn
            </span></label>
          </section>

          <section className="card">
            <h2>Lịch làm việc</h2>
            <div className="row">
              <label>Bắt đầu<input type="time" key={`s-${cal.startMin}`} defaultValue={minutesToHHMM(cal.startMin)}
                onBlur={(e) => { if (e.target.value) patch({ calendar: { startMin: hhmmToMinutes(e.target.value) } }); }} /></label>
              <label>Kết thúc<input type="time" key={`e-${cal.endMin}`} defaultValue={minutesToHHMM(cal.endMin)}
                onBlur={(e) => { if (e.target.value) patch({ calendar: { endMin: hhmmToMinutes(e.target.value) } }); }} /></label>
            </div>
            <div className="row inline">
              {DAY_ORDER.map((d) => (
                <label key={d} className="inline"><input type="checkbox" checked={cal.days.includes(d)}
                  onChange={() => patch({ calendar: { days: cal.days.includes(d) ? cal.days.filter((x) => x !== d) : [...cal.days, d] } })} />{d === 0 ? 'CN' : `T${d + 1}`}</label>
              ))}
            </div>
            <label className="inline spaced"><input type="checkbox" checked={cal.lunch !== null}
              onChange={(e) => patch({ calendar: { lunch: e.target.checked ? [720, 780] : null } })} />Nghỉ trưa 12:00 đến 13:00</label>
            <label className="spaced">Ngày nghỉ lễ (YYYY-MM-DD, cách nhau dấu phẩy)
              <input key={`h-${cal.holidays.join(',')}`} defaultValue={cal.holidays.join(', ')}
                onBlur={(e) => patch({ calendar: { holidays: (e.target.value as string).split(',').map((x: string) => x.trim()).filter(Boolean) } })} />
            </label>
          </section>
        </div>
      )}

      <section className="card">
        <h2>Tính hạn xử lý (TV7-08)</h2>
        <div className="row">
          <label>Bắt đầu<input type="datetime-local" value={calcStart} onChange={(e) => setCalcStart(e.target.value)} /></label>
          <label>Số giờ làm việc<input type="number" min={0.5} step={0.5} className="num" value={calcHours} onChange={(e) => setCalcHours(Number(e.target.value))} /></label>
        </div>
        <p className="strong">
          {!calcValid || deadline.data === null
            ? 'Nhập thời điểm bắt đầu và số giờ.'
            : `Hạn xử lý: ${formatTime(deadline.data)} (${WEEKDAYS[new Date(deadline.data).getDay()]})`}
        </p>
      </section>
    </>
  );
}
