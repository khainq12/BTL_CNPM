import { useState } from 'react';
import { api } from '../api';
import { useApp } from '../AppState';
import { STATUS_LABEL } from '../constants';
import { formatDuration, formatMoney } from '../format';
import { errorMessage, useAsync } from '../hooks';
import type { CaseStatus } from '../types';

export default function DashboardPage() {
  const { version, refresh } = useApp();
  const [empty, setEmpty] = useState(false);
  const [error, setError] = useState('');
  const view = useAsync(() => api.getDashboard(), [version]);

  if (!view.data) return <section className="card"><p className="mut">{view.error ?? 'Đang tải…'}</p></section>;
  const { stats: st, openAlerts, atRisk, pendingQuotes } = view.data;

  const toggleEmpty = () => { api.dev?.setEmpty(!empty); setEmpty(!empty); refresh(); };
  const approve = async (code: string) => {
    try { await api.approveQuote(code); setError(''); } catch (e) { setError(errorMessage(e)); }
    refresh();
  };

  const kpis: Array<[string, string | number, string]> = [
    ['Tổng phiếu', st.total, ''],
    ['Đang xử lý', st.inProgress, ''],
    ['Chờ khách hàng', st.waitingCustomer, ''],
    ['Hoàn thành', st.completed, ''],
    ['Sắp quá hạn', st.nearDeadline, 'wn'],
    ['Đã quá hạn', st.overdue, 'bad'],
    ['Cảnh báo chưa xử lý xong', openAlerts, openAlerts > 0 ? 'bad' : ''],
    ['Hoàn thành đúng hạn', st.onTimeRate === null ? '—' : `${Math.round(st.onTimeRate * 100)}%`, ''],
  ];
  const dist = (Object.entries(st.byStatus) as Array<[CaseStatus, number]>).sort((a, b) => b[1] - a[1]);

  return (
    <>
      {error && <p className="msg" role="alert">{error}</p>}
      <section className="card">
        <div className="row spread">
          <h2>Tổng quan hoạt động bảo hành</h2>
          {api.dev && <button className="btn s" onClick={toggleEmpty}>{empty ? 'Quay lại dữ liệu mẫu' : 'Xem khi chưa có phiếu nào'}</button>}
        </div>
        <div className="kpis">
          {kpis.map(([label, value, tone]) => <div key={label} className={`k ${tone}`}>{label}<b>{value}</b></div>)}
        </div>
        {st.total === 0 && <p className="mut">Chưa có phiếu nào trong kỳ. Các chỉ số hiển thị 0 và tỷ lệ đúng hạn hiển thị “—”.</p>}
        <small>Tỷ lệ đúng hạn = số mốc SLA hoàn tất đúng hạn / số mốc SLA đã hoàn tất.</small>
      </section>

      {pendingQuotes.length > 0 && (
        <section className="card">
          <h2>Báo giá chờ quản lý duyệt (trên 2.000.000 đồng)</h2>
          <div className="tw">
            <table>
              <thead><tr><th>Phiếu</th><th>Thiết bị</th><th>Tổng báo giá</th><th /></tr></thead>
              <tbody>
                {pendingQuotes.map((q) => (
                  <tr key={q.caseCode}>
                    <td>{q.caseCode}</td><td>{q.device}</td><td>{formatMoney(q.total)}</td>
                    <td><button className="btn s" onClick={() => approve(q.caseCode)}>Duyệt và gửi khách</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

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
          {atRisk.length === 0 ? <p className="mut">Không có phiếu nào.</p> : (
            <ul className="l">
              {atRisk.map((x) => (
                <li key={x.caseCode}>
                  {x.caseCode} · {x.slaCode}{' '}
                  <span className={`b ${x.state === 'BREACH' ? 'bad' : 'wn'}`}>{x.state === 'BREACH' ? 'Quá hạn' : 'Sắp quá hạn'}</span>{' '}
                  <small>{formatDuration(x.remainingMinutes)}</small>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
