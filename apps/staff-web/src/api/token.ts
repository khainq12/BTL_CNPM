// JWT do backend cấp (chỉ dùng ở chế độ gọi API thật). Lưu cùng phiên trong localStorage của trình duyệt.
const KEY = 'woms-token'

export function getToken(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setToken(t: string | null) {
  try {
    if (t) localStorage.setItem(KEY, t)
    else localStorage.removeItem(KEY)
  } catch {
    /* bộ nhớ bị chặn: token chỉ còn trong phiên hiện tại */
  }
}
