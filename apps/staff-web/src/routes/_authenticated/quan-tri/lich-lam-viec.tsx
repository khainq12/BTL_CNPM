import { createFileRoute } from '@tanstack/react-router'
import { WorkCalendar } from '@/features/admin/calendar'

export const Route = createFileRoute('/_authenticated/quan-tri/lich-lam-viec')({
  component: WorkCalendar,
})
