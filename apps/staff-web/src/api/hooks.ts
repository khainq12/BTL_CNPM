import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { User } from '@/domain/types'
import { loadDb, onExternalChange, StorageFullError, type Db } from '@/mock/db'
import { useAuthStore } from '@/stores/auth-store'
import { ApiError } from './service'

// Toàn bộ dữ liệu đọc qua một query. Khi có API thật, tách thành các query theo endpoint (GET /cases, /parts...).
export function useDb() {
  const qc = useQueryClient()
  useEffect(() => onExternalChange(() => qc.invalidateQueries({ queryKey: ['db'] })), [qc])
  return useQuery({
    queryKey: ['db'],
    queryFn: async () => structuredClone(loadDb()) as Db,
    initialData: () => structuredClone(loadDb()) as Db,
    staleTime: 0,
  }).data
}

export function useMe(): User {
  const db = useDb()
  const id = useAuthStore((s) => s.session?.userId)
  const u = db.users.find((x) => x.id === id)
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['db'] })
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
