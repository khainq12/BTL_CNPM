import { FINAL_STATUSES, PUBLIC_STEPS, PUBLIC_STEP_OF, STATUS_NOTE } from '../constants';
import { evaluateSla } from '../sla/engine';
import type { CaseStatus, PublicCase, WarrantyCase, WorkCalendar } from '../types';

export const MAX_FAILED_LOOKUPS = 5; // SRS UC-16: quá 5 lần sai thì yêu cầu xác nhận không phải máy
export const DEMO_OTP = '000000';    // BR-03: xác nhận báo giá bằng OTP. Giá trị cố định chỉ dùng cho bản mẫu

export const normalizePhone = (s: string) => s.replace(/\D/g, '');

/** Cần cả mã phiếu và số điện thoại. Mã phiếu dễ đoán nên không bao giờ dùng một mình (BR-11). */
export function findCase(cases: WarrantyCase[], code: string, phone: string): WarrantyCase | undefined {
  const c = code.trim().toUpperCase();
  const p = normalizePhone(phone);
  return cases.find((x) => x.code === c && x.phone === p);
}

export function toPublicCase(c: WarrantyCase): PublicCase {
  return {
    code: c.code,
    device: c.device,
    symptom: c.symptom,
    receivedAt: c.receivedAt,
    step: PUBLIC_STEP_OF[c.status],
    note: STATUS_NOTE[c.status] ?? '',
    events: c.events,
    quote: c.status === 'QUOTED' ? c.quote : 0,
  };
}

/** Sai mã và sai số điện thoại cho cùng một kết quả null, để không lộ phiếu có tồn tại hay không. */
export function lookupPublic(cases: WarrantyCase[], code: string, phone: string): PublicCase | null {
  const c = findCase(cases, code, phone);
  return c ? toPublicCase(c) : null;
}

export const casesOfPhone = (cases: WarrantyCase[], phone: string) => cases.filter((c) => c.phone === phone);

export function setStatus(c: WarrantyCase, status: CaseStatus, at: number): WarrantyCase {
  const step = PUBLIC_STEP_OF[status];
  const last = c.events.at(-1);
  const events = last && last.step === step ? c.events : [...c.events, { step, at }];
  return { ...c, status, events };
}

/** Khách đồng ý hoặc từ chối báo giá (TV7-06). Đồng ý thì tiếp tục SLA, từ chối thì đóng SLA và phiếu. */
export function respondToQuote(c: WarrantyCase, accept: boolean, now: number): WarrantyCase {
  if (c.status !== 'QUOTED') return c;
  const sla = c.sla.map((s, i) => {
    if (i !== c.sla.length - 1) return s;
    const pauses = s.pauses.map((p) => (p.to === null ? { ...p, to: now } : p));
    return { ...s, pauses, end: accept ? s.end : now };
  });
  return setStatus({ ...c, sla }, accept ? 'DIAGNOSING' : 'CANCELLED_RETURN', now);
}

export interface Notification { at: number; text: string }

export function buildNotifications(cases: WarrantyCase[], phone: string, limit = 5): Notification[] {
  return casesOfPhone(cases, phone)
    .flatMap((c) => c.events.map((e) => ({ at: e.at, text: `Phiếu ${c.code}: ${PUBLIC_STEPS[e.step]}` })))
    .sort((a, b) => b.at - a.at)
    .slice(0, limit);
}

export interface PublicEta { message: string; deadline: number | null }

/** Thông tin thời gian cho khách. Không lộ trạng thái SLA nội bộ. */
export function publicEta(c: WarrantyCase, now: number, cal: WorkCalendar, warnRatio: number): PublicEta {
  const last = c.sla.at(-1);
  if (!last || FINAL_STATUSES.includes(c.status)) return { message: '', deadline: null };
  const r = evaluateSla(last, now, cal, warnRatio);
  if (r.state === 'PAUSED') return { message: 'Thời gian đang tạm dừng, ngày dự kiến sẽ cập nhật khi xử lý tiếp tục.', deadline: null };
  if (r.state === 'BREACH') return { message: 'Thời gian xử lý đang vượt dự kiến, trung tâm sẽ liên hệ khi có cập nhật.', deadline: null };
  return { message: 'Dự kiến xong bước hiện tại:', deadline: r.deadline };
}
