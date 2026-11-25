import { createFileRoute } from '@tanstack/react-router'
import { Users } from '@/features/admin/users'

export const Route = createFileRoute('/_authenticated/quan-tri/tai-khoan')({
  component: Users,
})
