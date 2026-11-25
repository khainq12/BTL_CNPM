import { useEffect } from 'react'
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { emptyDb } from '@/domain/db'
import { setHolidays } from '@/domain/sla'
import type { User } from '@/domain/types'
import { onExternalChange, StorageFullError, type Db } from '@/mock/db'
import { useAuthStore } from '@/stores/auth-store'
import { isHttp } from './mode'
import { ApiError, fetchWorkspace } from './service'

// Dữ liệu làm việc của tài khoản: backend trả về phần dữ liệu vai trò được xem (GET /workspace, đã lọc theo RBAC);
// bản chạy thử đọc từ localStorage.
export const workspaceQuery = queryOptions({
  queryKey: ['db'],
  queryFn: async () => {
    const db = (await fetchWorkspace()) as Db
    setHolidays(db.holidays.map((h) => h.date))
    return db
  },
  staleTime: isHttp ? 5_000 : 0,
})

const EMPTY = emptyDb()

export function useDb(): Db {
  const qc = useQueryClient()
  useEffect(() => (isHttp ? undefined : onExternalChange(() => qc.invalidateQueries({ queryKey: ['db'] }))), [qc])
  const q = useQuery({ ...workspaceQuery, refetchInterval: isHttp ? 15_000 : false, refetchOnWindowFocus: isHttp })
  return q.data ?? EMPTY
}

export function useMe(): User {
  const db = useDb()
  const session = useAuthStore((s) => s.session)
  const u = db.users.find((x) => x.id === session?.userId) ?? (isHttp ? session?.user : undefined)
  if (!u) throw new Error('Phiên đăng nhập không hợp lệ')
  return u
}

export function describeError(e: unknown) {
  if (e instanceof ApiError) return e.message
  if (e instanceof StorageFullError) return 'Bộ nhớ trình duyệt đã đầy nên thay đổi chưa được lưu. Bớt ảnh đính kèm, hoặc khôi phục dữ liệu mẫu ở trang đăng nhập.'
  return 'Có lỗi không mong muốn. Thử lại sau ít phút; nếu vẫn lỗi, báo quản trị hệ thống.'
}

// Bọc mọi thao tác ghi: khóa nút trong lúc gửi (EX-13), báo lỗi rõ, xử lý xung đột phiên bản (EX-14).
export function useAction<A extends unknown[]>(fn: (...args: A) => Promise<unknown>, opts?: { success?: string; onDone?: () => void }) {
  const qc = useQueryClient()
  const signOut = useAuthStore((s) => s.signOut)
  const navigate = useNavigate()
  return useMutation({
    mutationFn: (args: A) => fn(...args),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['db'] })
      if (opts?.success) toast.success(opts.success)
      opts?.onDone?.()
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) {
        toast.error('Dữ liệu đã thay đổi', {
          description: e.message,
          duration: 10000,
          action: { label: 'Tải lại', onClick: () => qc.invalidateQueries({ queryKey: ['db'] }) },
        })
        return
      }
      if (e instanceof ApiError && e.status === 401) {
        signOut()
        navigate({ to: '/sign-in' })
      }
      toast.error(describeError(e))
    },
  })
}
