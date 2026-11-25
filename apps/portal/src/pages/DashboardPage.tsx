import { useState } from 'react';
import { FINAL_STATUSES, STATUS_LABEL } from '../constants';
import { formatDuration } from '../format';
import { computeStats, evaluateSla } from '../sla/engine';
import { useStore } from '../store';
import type { CaseStatus } from '../types';

export default function DashboardPage() {
  const { cases, now, calendar, warnRatio } = useStore();
  const [empty, setEmpty] = useState(false);
  const list = empty ? [] : cases;
  const st = computeStats(list, now, calendar, warnRatio);
  const risk = list
    .filter((c) => !FINAL_STATUSES.includes(c.status) && c.sla.length > 0)
    .map((c) => ({ c, sla: c.sla[c.sla.length - 1], r: evaluateSla(c.sla[c.sla.length - 1], now, calendar, warnRatio) }))
    .filter((x) => x.r.state === 'WARN' || x.r.state === 'BREACH');

  const kpis: Array<[string, string | number, string]> = [
    ['Tổng phiếu', st.total, ''],
    ['Đang xử lý', st.inProgress, ''],
    ['Chờ khách hàng', st.waitingCustomer, ''],
    ['Hoàn thành', st.completed, ''],
    ['Sắp quá hạn', st.nearDeadline, 'wn'],
    ['Đã quá hạn', st.overdue, 'bad'],
    ['Hoàn thành đúng hạn', st.onTimeRate === null ? '—' : `${Math.round(st.onTimeRate * 100)}%`, ''],
  ];
  const dist = (Object.entries(st.byStatus) as Array<[CaseStatus, number]>).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <section className="card">
        <div className="row spread">
          <h2>Tổng quan hoạt động bảo hành</h2>
          <button className="btn s" onClick={() => setEmpty((e) => !e)}>{empty ? 'Quay lại dữ liệu mẫu' : 'Xem khi chưa có phiếu nào'}</button>
        </div>
        <div className="kpis">
          {kpis.map(([label, value, tone]) => <div key={label} className={`k ${tone}`}>{label}<b>{value}</b></div>)}
        </div>
        {st.total === 0 && <p className="mut">Chưa có phiếu nào trong kỳ. Các chỉ số hiển thị 0 và tỷ lệ đúng hạn hiển thị “—”.</p>}
        <small>Tỷ lệ đúng hạn = số mốc SLA hoàn tất đúng hạn / số mốc SLA đã hoàn tất.</small>
      </section>

      <div className="two">
        <section className="card">
          <h2>Phân bố theo trạng thái</h2>
          {dist.length === 0 ? <p className="mut">Không có dữ liệu.</p> : dist.map(([k, n]) => (
            <div className="dist" key={k}>
              <span>{STATUS_LABEL[k]}</span>
              <div className="bar"><i style={{ width: `${(n / st.total) * 100}%` }} /></div>
              <b>{n}</b>
            </div>
          ))}
        </section>
        <section className="card">
          <h2>Phiếu có nguy cơ trễ hạn</h2>
          {risk.length === 0 ? <p className="mut">Không có phiếu nào.</p> : (
            <ul className="l">
              {risk.map(({ c, sla, r }) => (
                <li key={c.code}>
                  {c.code} · {sla.code}{' '}
                  <span className={`b ${r.state === 'BREACH' ? 'bad' : 'wn'}`}>{r.state === 'BREACH' ? 'Quá hạn' : 'Sắp quá hạn'}</span>{' '}
                  <small>{formatDuration(r.remaining)}</small>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
