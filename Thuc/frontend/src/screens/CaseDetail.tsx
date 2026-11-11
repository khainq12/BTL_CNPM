import { useState } from 'react'
import { Note, SlaChip, StatusBadge } from '../components/bits'
import type { Role } from '../config/roles'
import { CASE_TRANSITIONS, type Transition } from '../config/statuses'
import { formatDateTime } from '../lib/format'
import { CASES } from '../mock/data'

const TABS = ['Tổng quan', 'Quyền lợi', 'Chẩn đoán', 'Work Order', 'Linh kiện', 'Kiểm định', 'Bàn giao', 'Lịch sử'] as const

// S-04 Chi tiết phiếu: màn hình trung tâm. Chỉ hiện thao tác hợp lệ với vai trò và trạng thái.
export function CaseDetail({ id, role }: { id: string; role: Role }) {
  const c = CASES.find((x) => x.id === id)
  const [tab, setTab] = useState<(typeof TABS)[number]>('Tổng quan')
  const [pending, setPending] = useState<Transition | null>(null)
  const [reason, setReason] = useState('')

  if (!c) return <div className="empty">Không tìm thấy phiếu {id}. Phiếu có thể đã bị xóa hoặc bạn không có quyền xem.</div>

  const actions = CASE_TRANSITIONS.filter((t) => t.from === c.status && t.roles.includes(role))

  return (
    <>
      <div className="page-head">
        <div>
          <p className="muted" style={{ marginTop: 0 }}>
            <a href="#/case">Danh sách phiếu</a> / {c.id}
          </p>
          <h1>
            {c.asset.model} của {c.customer.name}
          </h1>
          <div className="row" style={{ marginTop: 8 }}>
            <StatusBadge status={c.status} />
            <SlaChip due={c.slaDueAt} paused={c.slaPaused} />
            <span className="muted">Phụ trách: {c.owner}</span>
          </div>
        </div>
        <div className="row">
          {actions.length === 0 && <span className="muted">Vai trò của bạn không có thao tác ở trạng thái này</span>}
          {actions.map((t) => (
            <button key={t.to} className="btn primary" onClick={() => setPending(t)}>
              {t.action}
            </button>
          ))}
        </div>
      </div>

      {c.blocked && (
        <div className="note" style={{ marginBottom: 16 }}>
          <b>Đang bị chặn: </b>
          {c.blocked}
        </div>
      )}

      {pending && (
        <section className="panel" style={{ marginBottom: 16 }} aria-label="Xác nhận chuyển trạng thái">
          <header>
            <h2>{pending.action}</h2>
          </header>
          <div className="body stack">
            {pending.guard && <p>Điều kiện: {pending.guard}</p>}
            {pending.needsReason && (
              <div className="field">
                <label htmlFor="reason">Lý do (bắt buộc)</label>
                <input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
            )}
            <div className="row">
              <button className="btn primary" disabled={pending.needsReason && !reason.trim()}>
                Xác nhận
              </button>
              <button className="btn" onClick={() => setPending(null)}>
                Hủy
              </button>
            </div>
            <Note>
              nút Xác nhận bị khóa trong lúc gửi (EX-13). Nếu phiếu đã bị người khác cập nhật (phiên bản hiện tại v
              {c.version}), hiện thông báo kèm nút tải lại (EX-14).
            </Note>
          </div>
        </section>
      )}

      <div className="row" role="tablist" style={{ gap: 4, borderBottom: '1px solid var(--line)', marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className="btn"
            style={{
              border: 'none',
              borderRadius: 0,
              borderBottom: tab === t ? '2px solid var(--ink)' : '2px solid transparent',
              background: 'none',
              fontWeight: tab === t ? 600 : 400,
            }}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Tổng quan' && (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <section className="panel">
            <header>
              <h2>Thiết bị</h2>
            </header>
            <dl className="body" style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px' }}>
              <dt className="muted">Loại</dt>
              <dd style={{ margin: 0 }}>{c.asset.kind}</dd>
              <dt className="muted">Model</dt>
              <dd style={{ margin: 0 }}>{c.asset.model}</dd>
              <dt className="muted">Serial</dt>
              <dd style={{ margin: 0 }}>{c.asset.serial}</dd>
              <dt className="muted">Phụ kiện</dt>
              <dd style={{ margin: 0 }}>{c.accessories.length ? c.accessories.join(', ') : 'Không có'}</dd>
              <dt className="muted">Triệu chứng</dt>
              <dd style={{ margin: 0 }}>{c.symptom}</dd>
            </dl>
          </section>
          <section className="panel">
            <header>
              <h2>Khách hàng</h2>
            </header>
            <dl className="body" style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px' }}>
              <dt className="muted">Họ tên</dt>
              <dd style={{ margin: 0 }}>{c.customer.name}</dd>
              <dt className="muted">Điện thoại</dt>
              <dd style={{ margin: 0 }}>{c.customer.phone}</dd>
              <dt className="muted">Kênh</dt>
              <dd style={{ margin: 0 }}>{c.channel}</dd>
              <dt className="muted">Tiếp nhận lúc</dt>
              <dd style={{ margin: 0 }}>{formatDateTime(c.receivedAt)}</dd>
              <dt className="muted">Hạn SLA</dt>
              <dd style={{ margin: 0 }}>{formatDateTime(c.slaDueAt)}</dd>
            </dl>
          </section>
          <section className="panel" style={{ gridColumn: '1 / -1' }}>
            <header>
              <h2>Ảnh hiện trạng</h2>
            </header>
            <div className="body">
              <div className="empty" style={{ border: '1px dashed var(--line-strong)', borderRadius: 6 }}>
                Khung ảnh: 4 ảnh chụp lúc tiếp nhận (chưa có wireframe)
              </div>
            </div>
          </section>
        </div>
      )}

      {tab === 'Lịch sử' && (
        <section className="panel">
          <ol className="body" style={{ margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[...c.history].reverse().map((e, i) => (
              <li key={i}>
                <div>{e.text}</div>
                <div className="muted" style={{ fontSize: '0.87rem' }}>
                  {e.actor}, {formatDateTime(e.at)}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {tab !== 'Tổng quan' && tab !== 'Lịch sử' && (
        <div className="panel empty">Tab "{tab}" sẽ được vẽ cùng các màn hình S-30, S-40, S-41, S-71, S-81.</div>
      )}
    </>
  )
}
