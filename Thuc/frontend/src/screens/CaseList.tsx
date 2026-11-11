import { useState } from 'react'
import { Note, SlaChip, StatusBadge } from '../components/bits'
import { CASE_STATUS, type CaseStatus } from '../config/statuses'
import { formatDateTime } from '../lib/format'
import { CASES } from '../mock/data'

// S-03 Danh sách phiếu. BR-11: tìm theo mã phiếu, SĐT, tên khách; không tìm chỉ bằng serial.
export function CaseList() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<CaseStatus | ''>('')
  const term = q.trim().toLowerCase()
  const rows = CASES.filter(
    (c) =>
      (!status || c.status === status) &&
      (!term ||
        c.id.toLowerCase().includes(term) ||
        c.customer.name.toLowerCase().includes(term) ||
        c.customer.phone.replace(/\s/g, '').includes(term.replace(/\s/g, ''))),
  )

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Danh sách phiếu</h1>
          <p>{rows.length} phiếu</p>
        </div>
        <a className="btn primary" href="#/tiep-nhan/moi" style={{ textDecoration: 'none' }}>
          Tạo phiếu tiếp nhận
        </a>
      </div>
      <form className="row" style={{ marginBottom: 16 }} role="search" onSubmit={(e) => e.preventDefault()}>
        <div className="field" style={{ flex: '1 1 280px' }}>
          <label htmlFor="q">Tìm phiếu</label>
          <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mã phiếu, số điện thoại hoặc tên khách" />
        </div>
        <div className="field">
          <label htmlFor="st">Trạng thái</label>
          <select id="st" value={status} onChange={(e) => setStatus(e.target.value as CaseStatus | '')}>
            <option value="">Tất cả</option>
            {(Object.keys(CASE_STATUS) as CaseStatus[]).map((s) => (
              <option key={s} value={s}>
                {CASE_STATUS[s].label}
              </option>
            ))}
          </select>
        </div>
      </form>
      <section className="panel">
        {rows.length === 0 ? (
          <div className="empty">Không tìm thấy phiếu phù hợp. Thử tìm bằng số điện thoại hoặc mã phiếu.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Phiếu</th>
                <th>Khách hàng</th>
                <th>Thiết bị</th>
                <th>Trạng thái</th>
                <th>SLA</th>
                <th>Phụ trách</th>
                <th>Tiếp nhận lúc</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <a href={`#/case/${c.id}`}>{c.id}</a>
                    <div className="sub">{c.channel}</div>
                  </td>
                  <td>
                    {c.customer.name}
                    <div className="sub">{c.customer.phone}</div>
                  </td>
                  <td>{c.asset.model}</td>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                  <td>
                    <SlaChip due={c.slaDueAt} paused={c.slaPaused} />
                  </td>
                  <td>{c.owner}</td>
                  <td>{formatDateTime(c.receivedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <div style={{ marginTop: 16 }}>
        <Note who="TV4">cách phân trang và lọc phía server; bản này lọc trên dữ liệu giả.</Note>
      </div>
    </>
  )
}
