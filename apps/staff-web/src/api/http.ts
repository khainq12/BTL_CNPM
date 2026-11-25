import type * as C from '@/domain/commands'
import type { Db } from '@/domain/db'
import { ApiError, type ApiErrorStatus } from '@/domain/errors'
import type { User } from '@/domain/types'
import { API_URL } from './mode'
import { getToken, setToken } from './token'

// Gọi backend thật (apps/api, NestJS). Mỗi hàm cùng chữ ký với bản chạy thử (mock.ts) để giao diện không phải đổi.
// Tham số "user" của các hàm được bỏ qua: backend xác định người gọi từ JWT, không tin dữ liệu gửi lên (BR-27).

type Args<F> = F extends (db: Db, user: User, ...rest: infer R) => unknown ? R : never

async function call<T = unknown>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const token = getToken()
  let res: Response
  try {
    res = await fetch(`${API_URL}/api/v1${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(503, 'Không kết nối được máy chủ WOMS. Kiểm tra mạng rồi thử lại.')
  }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = typeof data?.message === 'string' ? data.message : Array.isArray(data?.message) ? data.message.join('; ') : 'Máy chủ báo lỗi.'
    throw new ApiError((res.status as ApiErrorStatus) ?? 500, message, data?.code)
  }
  return data as T
}

const v = (version: number, rest?: object) => ({ version, ...rest })

export type LoginResult = { accessToken: string; expiresAt: string; user: User }

export const loginWithToken = (username: string, password: string) => call<LoginResult>('POST', '/auth/login', { username, password })
export const fetchMe = () => call<User>('GET', '/auth/me')
export async function login(username: string, password: string) {
  const r = await loginWithToken(username, password)
  setToken(r.accessToken)
  return r.user
}
export const logAudit = (_u: User, action: string) => void call('POST', '/auth/logout', { action }).catch(() => undefined)
export const changePassword = (_u: User, current: string, next: string) => call('POST', '/auth/change-password', { current, next })

export const fetchWorkspace = () => call<Db>('GET', '/workspace')

export const createCase = (_u: User, input: C.IntakeInput, idempotencyKey: string) => call('POST', '/cases', input, { 'Idempotency-Key': idempotencyKey })
export const acceptOnline = (_u: User, ...[id, ver, d]: Args<typeof C.acceptOnline>) => call('POST', `/cases/${id}/accept-online`, v(ver, d))
export const requestCancel = (_u: User, ...[id, ver, reason]: Args<typeof C.requestCancel>) => call('POST', `/cases/${id}/cancel-request`, v(ver, { reason }))
export const savePrecheck = (_u: User, ...[id, ver, d]: Args<typeof C.savePrecheck>) => call('PUT', `/cases/${id}/precheck`, v(ver, d))
export const requestInfo = (_u: User, ...[id, ver, reason]: Args<typeof C.requestInfo>) => call('POST', `/cases/${id}/info-request`, v(ver, { reason }))
export const infoSupplied = (_u: User, ...[id, ver, note]: Args<typeof C.infoSupplied>) => call('POST', `/cases/${id}/info-supplied`, v(ver, { note }))
export const assignDiagnosis = (_u: User, ...[id, ver, techId, reason]: Args<typeof C.assignDiagnosis>) =>
  call('PUT', `/cases/${id}/diagnosis-assignment`, v(ver, { techId, reason }))
export const submitDiagnosis = (_u: User, ...[id, ver, d]: Args<typeof C.submitDiagnosis>) => call('PUT', `/cases/${id}/diagnosis`, v(ver, d))
export const decideEligibility = (_u: User, ...[id, ver, d]: Args<typeof C.decideEligibility>) => call('PUT', `/cases/${id}/eligibility`, v(ver, d))
export const sendApprovedQuote = (_u: User, ...[id, ver]: Args<typeof C.sendApprovedQuote>) => call('POST', `/cases/${id}/quote/send`, v(ver))
export const recordQuoteResponse = (_u: User, ...[id, ver, d]: Args<typeof C.recordQuoteResponse>) => call('POST', `/cases/${id}/quote/response`, v(ver, d))
export const confirmReturn = (_u: User, ...[id, ver, d]: Args<typeof C.confirmReturn>) => call('POST', `/cases/${id}/return-conclusion`, v(ver, d))
export const assignRepair = (_u: User, ...[id, ver, techId, reason]: Args<typeof C.assignRepair>) =>
  call('PUT', `/cases/${id}/repair-assignment`, v(ver, { techId, reason }))
export const startRepair = (_u: User, ...[id, ver]: Args<typeof C.startRepair>) => call('POST', `/cases/${id}/repair/start`, v(ver))
export const finishRepair = (_u: User, ...[id, ver, used, note]: Args<typeof C.finishRepair>) => call('POST', `/cases/${id}/repair/finish`, v(ver, { used, note }))
export const proposePlanChange = (_u: User, ...[id, ver, d]: Args<typeof C.proposePlanChange>) => call('POST', `/cases/${id}/plan-changes`, v(ver, d))
export const reviewPlanChange = (_u: User, ...[id, ver, d]: Args<typeof C.reviewPlanChange>) => call('POST', `/cases/${id}/plan-changes/current/review`, v(ver, d))
export const sendPlanChangeQuote = (_u: User, ...[id, ver]: Args<typeof C.sendPlanChangeQuote>) => call('POST', `/cases/${id}/plan-changes/current/send-quote`, v(ver))
export const respondPlanChange = (_u: User, ...[id, ver, d]: Args<typeof C.respondPlanChange>) => call('POST', `/cases/${id}/plan-changes/current/response`, v(ver, d))
export const submitQc = (_u: User, ...[id, ver, items, defect, photos]: Args<typeof C.submitQc>) => call('POST', `/cases/${id}/qc`, v(ver, { items, defect, photos }))
export const handover = (_u: User, ...[id, ver, d]: Args<typeof C.handover>) => call('POST', `/cases/${id}/handover`, v(ver, d))

export const reserveParts = (_u: User, woId: string) => call('POST', `/work-orders/${woId}/reserve`)
export const markShortage = (_u: User, woId: string, note: string) => call('POST', `/work-orders/${woId}/shortage`, { note })
export const issueParts = (_u: User, woId: string) => call('POST', `/work-orders/${woId}/issue`)
export const confirmPartReturn = (_u: User, woId: string, partId: string) => call('POST', `/work-orders/${woId}/parts/${partId}/return`)
export const toggleTask = (_u: User, woId: string, taskId: string) => call('PATCH', `/work-orders/${woId}/tasks/${encodeURIComponent(taskId)}/toggle`)
export const addWoLog = (_u: User, woId: string, text: string) => call('POST', `/work-orders/${woId}/logs`, { text })

export const stockIn = (_u: User, partId: string, qty: number, note: string, forPurchase = true) => call('POST', '/inventory/stock-in', { partId, qty, note, forPurchase })
export const requestPurchase = (_u: User, partId: string, qty: number, reason: string) => call('POST', '/inventory/purchase-requests', { partId, qty, reason })
export const requestAdjust = (_u: User, partId: string, counted: number, reason: string) => call('POST', '/inventory/adjustments', { partId, counted, reason })

export const decideApproval = (_u: User, ...[id, d]: Args<typeof C.decideApproval>) => call('POST', `/approvals/${id}/decision`, d)
export const createComplaint = (_u: User, caseId: string, content: string) => call('POST', '/complaints', { caseId, content })
export const updateComplaint = (_u: User, ...[id, status, resolution]: Args<typeof C.updateComplaint>) => call('PATCH', `/complaints/${id}`, { status, resolution })

export const saveUser = (_u: User, u: Parameters<typeof C.saveUser>[2]) => (u.id ? call<User>('PUT', `/users/${u.id}`, u) : call<User>('POST', '/users', u))
export const resetPassword = (_u: User, userId: string) => call('POST', `/users/${userId}/reset-password`)
export const addHoliday = (_u: User, date: string, name: string) => call('POST', '/holidays', { date, name })
export const removeHoliday = (_u: User, date: string) => call('DELETE', `/holidays/${date}`)
