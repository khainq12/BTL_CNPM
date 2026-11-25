import { createFileRoute } from '@tanstack/react-router'
import { AuditLog } from '@/features/admin/audit'

export const Route = createFileRoute('/_authenticated/quan-tri/nhat-ky')({
  component: AuditLog,
})
