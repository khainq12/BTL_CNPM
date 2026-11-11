import { Note, SlaChip, StatusBadge } from '../components/bits'
import { ROLES, type Role } from '../config/roles'
import { CASE_TRANSITIONS } from '../config/statuses'
import { slaState } from '../lib/format'
import { CASES, type WarrantyCase } from '../mock/data'

// S-02 Hộp việc: phiếu mà vai trò hiện tại có thể thao tác, sắp theo độ gấp của SLA.
export function Inbox({ role }: { role: Role }) {
  const mine = CASES.filter((c) => CASE_TRANSITIONS.some((t) => t.from === c.status && t.roles.includes(role)))
  const rank = (c: WarrantyCase) => ({ overdue: 0, soon: 1, ok: 2, paused: 3 })[slaState(c.slaDueAt, c.slaPaused).kind]
  mine.sort((a, b) => rank(a) - rank(b) || a.slaDueAt.localeCompare(b.slaDueAt))
  const overdue = mine.filter((c) => rank(c) === 0).length

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Hộp việc</h1>
          <p>
            {mine.length} phiếu chờ {ROLES[role].toLowerCase()} xử lý
            {overdue > 0 && `, ${overdue} phiếu đã quá hạn`}
          </p>
        </div>
      </div>
      <section className="panel">
        {mine.length === 0 ? (
          <div className="empty">Không có phiếu nào chờ bạn xử lý.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Phiếu</th>
                <th>Thiết bị</th>
                <th>Trạng thái</th>
                <th>SLA</th>
                <th>Việc cần làm</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((c) => {
                const next = CASE_TRANSITIONS.filter((t) => t.from === c.status && t.roles.includes(role))
                return (
                  <tr key={c.id}>
                    <td>
                      <a href={`#/case/${c.id}`}>{c.id}</a>
                      <div className="sub">{c.customer.name}</div>
                    </td>
                    <td>
                      {c.asset.model}
                      <div className="sub">{c.asset.kind}</div>
                    </td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td>
                      <SlaChip due={c.slaDueAt} paused={c.slaPaused} />
                    </td>
                    <td>
                      {next.map((t) => t.action).join(' / ')}
                      {c.blocked && <div className="sub">Đang bị chặn: {c.blocked}</div>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
      <div style={{ marginTop: 16 }}>
        <Note>
          Hộp việc lấy danh sách phiếu mà vai trò này được phép chuyển trạng thái. Kỹ thuật viên, kho, kiểm định sẽ thấy
          task và Work Order thay vì phiếu (chưa có wireframe).
        </Note>
      </div>
    </>
  )
}
