import { ApiError, commands as C, createSeedDb, findPublicCase, publicHistory, toPublicCase, type Db, type PublicCase } from '@woms/domain'

// Cổng khách hàng gọi API công khai của backend (VITE_API_URL). Không đặt VITE_API_URL thì chạy bản thử trong trình duyệt
// với cùng dữ liệu mẫu và cùng quy tắc @woms/domain (dữ liệu giữ trong sessionStorage của tab).
const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')
export const isDemo = !API
export const DEMO_OTP = '000000'

export type LookupResult = {
  case: PublicCase
  history: ReturnType<typeof publicHistory>
  notifications: { at: string; text: string }[]
}
export type RequestInput = C.OnlineRequestInput

async function post<T>(path: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API}/api/v1/public${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
  } catch {
    throw new ApiError(503, 'Không kết nối được máy chủ. Vui lòng thử lại sau.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status as 400, typeof data.message === 'string' ? data.message : 'Thông tin chưa hợp lệ. Kiểm tra lại các ô đã nhập.')
  return data as T
}

// ---- bản thử trong trình duyệt ----
const KEY = 'woms-portal-demo'
function load(): Db {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Db
  } catch {
    /* bỏ qua */
  }
  return createSeedDb()
}
function save(db: Db) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    /* bỏ qua */
  }
}
const NOT_FOUND = 'Không tìm thấy phiếu phù hợp. Kiểm tra lại mã phiếu và số điện thoại.'

export async function lookup(code: string, phone: string): Promise<LookupResult> {
  if (!isDemo) return post('/lookup', { code, phone })
  const db = load()
  const c = findPublicCase(db, code, phone)
  if (!c) throw new ApiError(404, NOT_FOUND)
  return { case: toPublicCase(db, c), history: publicHistory(db, c.customerId), notifications: [] }
}

export async function submitRequest(input: RequestInput, idempotencyKey: string): Promise<{ code: string; message: string }> {
  if (!isDemo) return post('/requests', input, { 'Idempotency-Key': idempotencyKey })
  const db = load()
  const c = C.createOnlineRequest(db, input, idempotencyKey)
  save(db)
  return { code: c.code, message: 'Đã ghi nhận yêu cầu (bản thử). Vui lòng mang thiết bị tới trung tâm và đọc mã phiếu cho nhân viên tiếp nhận.' }
}

export async function respondQuote(code: string, phone: string, otp: string, accepted: boolean) {
  if (!isDemo) return post('/quote-response', { code, phone, otp, accepted })
  const db = load()
  const c = findPublicCase(db, code, phone)
  if (!c) throw new ApiError(404, NOT_FOUND)
  if (otp !== DEMO_OTP) throw new ApiError(422, 'Mã OTP chưa đúng.')
  C.customerRespondQuote(db, c.id, accepted)
  save(db)
  return { ok: true }
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Có lỗi không mong muốn. Vui lòng thử lại.')
