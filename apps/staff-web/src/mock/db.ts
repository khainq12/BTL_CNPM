import { createSeedDb, type Db } from '@/domain/db'
import { setHolidays } from '@/domain/sla'

// "Backend giả" lưu trong localStorage để dữ liệu còn sau khi tải lại trang và dùng chung giữa các tab
// (mở 2 tab với 2 tài khoản để thử xung đột phiên bản EX-14). Khi đặt VITE_API_URL, giao diện dùng backend thật.

export type { Db }

const KEY = 'woms-db-v3' // đổi khi cấu trúc dữ liệu giả thay đổi, để trình duyệt nạp lại dữ liệu mẫu

const fresh = createSeedDb

let cache: Db | null = null

// Xóa dữ liệu của các phiên bản cũ (có thể chứa ảnh) để không chiếm dung lượng trình duyệt.
function dropOldVersions() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('woms-db-') && k !== KEY) localStorage.removeItem(k)
  } catch {
    // bộ nhớ trình duyệt bị chặn: bỏ qua
  }
}

export function loadDb(): Db {
  if (cache) return cache
  dropOldVersions()
  try {
    const raw = localStorage.getItem(KEY)
    cache = raw ? (JSON.parse(raw) as Db) : fresh()
  } catch {
    cache = fresh()
  }
  setHolidays(cache.holidays.map((h) => h.date))
  return cache
}

export class StorageFullError extends Error {}

export function saveDb(db: Db) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch (e) {
    // Hết dung lượng (thường do ảnh): không nhận thay đổi để dữ liệu hiển thị khớp với dữ liệu đã lưu.
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) throw new StorageFullError()
    // Bộ nhớ bị chặn (chế độ riêng tư): vẫn chạy trong phiên hiện tại.
  }
  cache = db
  setHolidays(db.holidays.map((h) => h.date))
}

export function resetDb() {
  cache = fresh()
  saveDb(cache)
}

// Tab khác ghi dữ liệu thì bỏ cache để đọc lại.
export function onExternalChange(cb: () => void) {
  const handler = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null
      cb()
    }
  }
  window.addEventListener('storage', handler)
  return () => window.removeEventListener('storage', handler)
}
