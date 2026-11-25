import { create } from 'zustand'
import { PARAMS } from '@/domain/params'
import type { User } from '@/domain/types'
import { isHttp } from '@/api/mode'
import { setToken } from '@/api/token'
import { loadDb } from '@/mock/db'

// Phiên đăng nhập. Chế độ API thật: JWT do backend cấp (api/token.ts) và thông tin tài khoản trả về lúc đăng nhập.
// Bản chạy thử: lưu id tài khoản + hạn phiên 8 giờ (PARAMS.sessionHours).
const KEY = 'woms-session'
type Session = { userId: string; exp: number; user?: User }

function read(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Session | null
    return s && s.exp > Date.now() ? s : null
  } catch {
    return null
  }
}

type AuthState = {
  session: Session | null
  signIn: (u: User) => void
  signOut: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  session: read(),
  signIn: (u) => {
    const session: Session = { userId: u.id, exp: Date.now() + PARAMS.sessionHours * 3600_000, user: isHttp ? { ...u, password: '' } : undefined }
    try {
      localStorage.setItem(KEY, JSON.stringify(session))
    } catch {
      /* phiên chỉ còn trong bộ nhớ */
    }
    set({ session })
  },
  signOut: () => {
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* bỏ qua */
    }
    setToken(null)
    set({ session: null })
  },
}))

// Đọc phiên hiện tại ngoài React (dùng trong beforeLoad của router).
export function currentUser(): User | null {
  const s = read()
  if (!s) return null
  if (isHttp) return s.user ?? null
  const u = loadDb().users.find((x) => x.id === s.userId)
  return u && u.active ? u : null
}
