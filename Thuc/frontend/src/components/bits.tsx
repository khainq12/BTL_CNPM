import type { ReactNode } from 'react'
import { CASE_STATUS, type CaseStatus } from '../config/statuses'
import { slaState } from '../lib/format'

export function StatusBadge({ status }: { status: CaseStatus }) {
  const s = CASE_STATUS[status]
  return <span className={`badge tone-${s.tone}`}>{s.label}</span>
}

export function SlaChip({ due, paused }: { due: string; paused?: boolean }) {
  const s = slaState(due, paused)
  return <span className={`sla ${s.kind}`}>{s.text}</span>
}

// Ghi chú của wireframe: giả định hoặc câu hỏi chờ nhóm trả lời.
export function Note({ children, who }: { children: ReactNode; who?: string }) {
  return (
    <div className="note" role="note">
      <b>{who ? `Chờ ${who}: ` : 'Giả định: '}</b>
      {children}
    </div>
  )
}
