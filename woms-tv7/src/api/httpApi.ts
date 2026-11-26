import type { WomsApi, LookupResult, PortalCaseView, SlaRow, AlertView, DashboardView, SlaSettings } from './contract';
import { ApiError, type ApiErrorCode, type CaptchaChallenge } from './contract';

/**
 * Bản gọi backend thật. Đường dẫn và mã lỗi theo docs/API_CONTRACT_TV7.md.
 * Khi TV4 chốt hợp đồng khác, chỉ cần sửa file này, giao diện không phải sửa.
 * getToken trả về token đăng nhập nội bộ (khu vực SLA, Dashboard). Portal khách dùng X-Portal-Session.
 */
export function createHttpApi(baseUrl: string, getToken: () => string | null = () => null): WomsApi {
  async function request<T>(method: string, path: string, body?: unknown, session?: string): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (session) headers['X-Portal-Session'] = session;
    const res = await fetch(`${baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!res.ok) {
      let code: ApiErrorCode = 'INTERNAL';
      let message = res.statusText;
      let challenge: CaptchaChallenge | undefined;
      try {
        const j = await res.json();
        code = j.code ?? code;
        message = j.message ?? message;
        challenge = j.challenge;
      } catch { /* phản hồi không có JSON */ }
      throw new ApiError(code, message, challenge);
    }
    return (res.status === 204 ? undefined : await res.json()) as T;
  }
  const enc = encodeURIComponent;

  return {
    async lookup(req): Promise<LookupResult> {
      try {
        return { ok: true, ...(await request<{ session: string; view: PortalCaseView }>('POST', '/portal/lookup', req)) };
      } catch (e) {
        if (e instanceof ApiError && (e.code === 'NOT_FOUND' || e.code === 'CAPTCHA_REQUIRED' || e.code === 'CAPTCHA_WRONG')) {
          return { ok: false, reason: e.code, challenge: e.challenge };
        }
        throw e;
      }
    },
    openCase: (session, code) => request('GET', `/portal/cases/${enc(code)}`, undefined, session),
    requestQuoteOtp: (session, code) => request('POST', `/portal/cases/${enc(code)}/quote/otp`, undefined, session),
    respondQuote: (session, code, body) => request('POST', `/portal/cases/${enc(code)}/quote/respond`, body, session),

    listSla: () => request<SlaRow[]>('GET', '/sla/cases'),
    pauseSla: (code, kind) => request('POST', `/sla/cases/${enc(code)}/pause`, { kind }),
    resumeSla: (code) => request('POST', `/sla/cases/${enc(code)}/resume`),
    finishSla: (code) => request('POST', `/sla/cases/${enc(code)}/finish`),
    getSlaHistory: (code) => request('GET', `/sla/cases/${enc(code)}/history`),
    getSettings: () => request<SlaSettings>('GET', '/sla/settings'),
    updateSettings: (patch) => request<SlaSettings>('PUT', '/sla/settings', patch),
    async calculateDeadline(start, hours) {
      return (await request<{ deadline: number | null }>('POST', '/sla/deadline', { start, hours })).deadline;
    },
    listAlerts: () => request<AlertView[]>('GET', '/sla/alerts'),
    actOnAlert: (id, command) => request<AlertView>('POST', `/sla/alerts/${enc(id)}/actions`, { command }),
    getDashboard: () => request<DashboardView>('GET', '/dashboard'),
    approveQuote: (code) => request('POST', `/quotes/${enc(code)}/approve`),
  };
}
