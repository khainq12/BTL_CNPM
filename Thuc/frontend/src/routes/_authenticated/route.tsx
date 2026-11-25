import { createFileRoute, redirect } from '@tanstack/react-router'
import { currentUser } from '@/stores/auth-store'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

// Chưa đăng nhập hoặc phiên hết hạn thì chuyển về trang đăng nhập, giữ lại trang đang mở.
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ location }) => {
    if (!currentUser()) throw redirect({ to: '/sign-in', search: { redirect: location.href } })
  },
  component: AuthenticatedLayout,
})
