import { createFileRoute, redirect } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { workspaceQuery } from '@/api/hooks'
import { ApiError } from '@/api/service'
import { currentUser, useAuthStore } from '@/stores/auth-store'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

// Chưa đăng nhập hoặc phiên hết hạn thì chuyển về trang đăng nhập, giữ lại trang đang mở.
// Nạp dữ liệu làm việc trước khi vẽ trang (chế độ API thật): token hết hạn thì đăng nhập lại.
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ location }) => {
    if (!currentUser()) throw redirect({ to: '/sign-in', search: { redirect: location.href } })
  },
  loader: async ({ context, location }) => {
    try {
      await context.queryClient.ensureQueryData(workspaceQuery)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        useAuthStore.getState().signOut()
        throw redirect({ to: '/sign-in', search: { redirect: location.href } })
      }
      throw e
    }
  },
  pendingComponent: () => (
    <div className='text-muted-foreground flex h-svh items-center justify-center gap-2 text-sm' role='status'>
      <Loader2 className='size-4 animate-spin' /> Đang tải dữ liệu…
    </div>
  ),
  component: AuthenticatedLayout,
})
