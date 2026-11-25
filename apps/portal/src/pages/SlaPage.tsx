import { useState } from 'react';
import { STATUS_LABEL } from '../constants';
import { WEEKDAYS, formatDuration, formatTime, hhmmToMinutes, minutesToHHMM, toInputValue } from '../format';
import { addWorkingMinutes } from '../sla/calendar';
import { buildSlaHistory, evaluateSla } from '../sla/engine';
import { useStore } from '../store';
import type { PolicyMap, SlaState } from '../types';

const BADGE: Record<SlaState, [string, string]> = {
  OK: ['Đúng tiến độ', 'ok'], WARN: ['Sắp quá hạn', 'wn'], BREACH: ['Quá hạn', 'bad'],
  PAUSED: ['Tạm dừng', 'mut'], DONE: ['Hoàn tất đúng hạn', 'ok'], LATE: ['Hoàn tất trễ', 'bad'],
};
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function SlaPage() {
  const s = useStore();
  const [selected, setSelected] = useState<string | null>(null);
  const [calcStart, setCalcStart] = useState(() => toInputValue(s.now));
  const [calcHours, setCalcHours] = useState(16);
  const [holidays, setHolidays] = useState(s.calendar.holidays.join(', '));

  const current = s.cases.find((c) => c.code === selected) ?? s.cases[0];
  const history = current ? buildSlaHistory(current, s.now, s.calendar, s.warnRatio) : [];
  const calcAt = addWorkingMinutes(new Date(calcStart).getTime(), calcHours * 60, s.calendar);
  const toggleDay = (d: number) =>
    s.setCalendar((c) => ({ ...c, days: c.days.includes(d) ? c.days.filter((x) => x !== d) : [...c.days, d] }));

  return (
    <>
      <section className="card">
        <h2>Theo dõi thời gian xử lý (TV7-09, 10, 11)</h2>
        <p className="mut">
          Mỗi phiếu hiển thị mốc SLA đang chạy. Cảnh báo từ {Math.round(s.warnRatio * 100)}% thời hạn, vi phạm khi vượt 100%.
          Đổi “Giờ hệ thống mẫu” ở thanh trên để xem trạng thái thay đổi.
        </p>
        <div className="tw">
          <table>
            <thead><tr><th>Phiếu</th><th>Trạng thái phiếu</th><th>Mốc</th><th>Hạn</th><th>Còn lại</th><th>Đã dùng</th><th>SLA</th><th>Thao tác</th></tr></thead>
            <tbody>
              {s.cases.map((c) => {
                const sla = c.sla.at(-1);
                if (!sla) return null;
                const r = evaluateSla(sla, s.now, s.calendar, s.warnRatio);
                const [label, tone] = BADGE[r.state];
                const pct = Math.round(r.ratio * 100);
                const paused = sla.pauses.some((p) => p.to === null);
                return (
                  <tr key={c.code}>
                    <td>{c.code}</td>
                    <td>{STATUS_LABEL[c.status]}</td>
                    <td>{sla.code}</td>
                    <td>{r.state === 'PAUSED' || r.deadline === null ? 'Tạm dừng' : formatTime(r.deadline)}</td>
                    <td>{sla.end !== null ? '—' : formatDuration(r.remaining)}</td>
                    <td><div className={`bar ${tone}`}><i style={{ width: `${Math.min(100, pct)}%` }} /></div><small>{pct}%</small></td>
                    <td><span className={`b ${tone}`}>{label}</span></td>
                    <td className="acts">
                      {sla.end === null && (paused
                        ? <button className="btn s" onClick={() => s.resumeSla(c.code)}>Tiếp tục</button>
                        : <button className="btn s" onClick={() => s.pauseSla(c.code)}>Tạm dừng</button>)}
                      {sla.end === null && <button className="btn s" onClick={() => s.finishSla(c.code)}>Hoàn tất</button>}
                      <button className="btn s" onClick={() => setSelected(c.code)}>Lịch sử</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {current && (
        <section className="card">
          <h2>Lịch sử SLA của {current.code} (TV7-12)</h2>
          <div className="tw">
            <table>
              <thead><tr><th>Thời điểm</th><th>Mốc</th><th>Sự kiện</th></tr></thead>
              <tbody>{history.map((h, i) => <tr key={i}><td>{formatTime(h.at)}</td><td>{h.sla}</td><td>{h.text}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}

      <div className="two">
        <section className="card">
          <h2>Chính sách SLA (TV7-07)</h2>
          {(Object.keys(s.policy) as Array<keyof PolicyMap>).map((k) => (
            <label key={k} className="field">
              {k} {s.policy[k].name}
              <span>
                <input type="number" min={0.5} step={0.5} className="num" value={s.policy[k].hours}
                  onChange={(e) => { const v = Number(e.target.value); if (v > 0) s.setPolicyHours(k, v); }} /> giờ làm việc
              </span>
            </label>
          ))}
          <small>Thay đổi chỉ áp dụng cho SLA tạo mới. Giá trị theo mục B.6 của SRS, chưa xác nhận thực địa.</small>
          <h3>Ngưỡng cảnh báo</h3>
          <label className="field"><span>
            <input type="number" min={1} max={99} className="num" value={Math.round(s.warnRatio * 100)}
              onChange={(e) => { const v = Number(e.target.value); if (v > 0 && v < 100) s.setWarnRatio(v / 100); }} /> % thời hạn
          </span></label>
        </section>

        <section className="card">
          <h2>Lịch làm việc</h2>
          <div className="row">
            <label>Bắt đầu<input type="time" value={minutesToHHMM(s.calendar.startMin)} onChange={(e) => s.setCalendar((c) => ({ ...c, startMin: hhmmToMinutes(e.target.value) }))} /></label>
            <label>Kết thúc<input type="time" value={minutesToHHMM(s.calendar.endMin)} onChange={(e) => s.setCalendar((c) => ({ ...c, endMin: hhmmToMinutes(e.target.value) }))} /></label>
          </div>
          <div className="row inline">
            {DAY_ORDER.map((d) => (
              <label key={d} className="inline"><input type="checkbox" checked={s.calendar.days.includes(d)} onChange={() => toggleDay(d)} />{d === 0 ? 'CN' : `T${d + 1}`}</label>
            ))}
          </div>
          <label className="inline spaced"><input type="checkbox" checked={s.calendar.lunch !== null}
            onChange={(e) => s.setCalendar((c) => ({ ...c, lunch: e.target.checked ? [720, 780] : null }))} />Nghỉ trưa 12:00 đến 13:00</label>
          <label className="spaced">Ngày nghỉ lễ (YYYY-MM-DD, cách nhau dấu phẩy)
            <input value={holidays} onChange={(e) => setHolidays(e.target.value)}
              onBlur={() => s.setCalendar((c) => ({ ...c, holidays: holidays.split(',').map((x) => x.trim()).filter(Boolean) }))} />
          </label>
        </section>
      </div>

      <section className="card">
        <h2>Tính hạn xử lý (TV7-08)</h2>
        <div className="row">
          <label>Bắt đầu<input type="datetime-local" value={calcStart} onChange={(e) => setCalcStart(e.target.value)} /></label>
          <label>Số giờ làm việc<input type="number" min={0.5} step={0.5} className="num" value={calcHours} onChange={(e) => setCalcHours(Number(e.target.value))} /></label>
        </div>
        <p className="strong">
          {calcAt === null || !(calcHours > 0) || isNaN(new Date(calcStart).getTime())
            ? 'Nhập thời điểm bắt đầu và số giờ.'
            : `Hạn xử lý: ${formatTime(calcAt)} (${WEEKDAYS[new Date(calcAt).getDay()]})`}
        </p>
      </section>
    </>
  );
}
