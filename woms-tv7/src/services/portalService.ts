import { FINAL_STATUSES, POST_REPAIR_WARRANTY_MONTHS, PUBLIC_STEPS, PUBLIC_STEP_OF, STATUS_NOTE } from '../constants';
import { addMonths } from '../sla/calendar';
import { evaluateSla } from '../sla/engine';
import type { CaseStatus, HistoryEntry, PublicCase, WarrantyCase, WorkCalendar } from '../types';
import { quoteReminderTimes, toPublicQuote } from './quoteService';

export const MAX_FAILED_LOOKUPS = 5; // SRS UC-16: quá 5 lần sai thì yêu cầu xác nhận không phải máy
export const DEMO_OTP = '000000';    // BR-03: xác nhận báo giá bằng OTP. Giá trị cố định chỉ dùng cho bản mẫu

export const normalizePhone = (s: string) => s.replace(/\D/g, '');

/** Cần cả mã phiếu và số điện thoại. Mã phiếu dễ đoán nên không bao giờ dùng một mình (BR-27). */
export function findCase(cases: WarrantyCase[], code: string, phone: string): WarrantyCase | undefined {
  const c = code.trim().toUpperCase();
  const p = normalizePhone(phone);
  return cases.find((x) => x.code === c && x.phone === p);
}

export function toPublicCase(c: WarrantyCase): PublicCase {
  const quote = toPublicQuote(c);
  const pendingApproval = c.status === 'QUOTED' && c.quote?.status === 'PENDING_MANAGER';
  return {
    code: c.code,
    serial: c.serial,
    device: c.device,
    symptom: c.symptom,
    receivedAt: c.receivedAt,
    step: PUBLIC_STEP_OF[c.status],
    note: pendingApproval ? 'Trung tâm đang hoàn tất báo giá, chúng tôi sẽ thông báo khi gửi cho bạn.' : (STATUS_NOTE[c.status] ?? ''),
    closed: FINAL_STATUSES.includes(c.status),
    events: c.events,
    quote,
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

/** Khách đồng ý hoặc từ chối báo giá (TV7-06). Chỉ áp dụng cho báo giá đã gửi cho khách. */
export function respondToQuote(c: WarrantyCase, accept: boolean, now: number): WarrantyCase {
  if (c.status !== 'QUOTED' || !c.quote || c.quote.status !== 'SENT') return c;
  const sla = c.sla.map((s, i) => {
    if (i !== c.sla.length - 1) return s;
    const pauses = s.pauses.map((p) => (p.to === null ? { ...p, to: now } : p));
    return { ...s, pauses, end: accept ? s.end : now };
  });
  const quote = { ...c.quote, status: accept ? ('ACCEPTED' as const) : ('REJECTED' as const) };
  return setStatus({ ...c, sla, quote }, accept ? 'DIAGNOSING' : 'CANCELLED_RETURN', now);
}

export interface Notification { at: number; text: string }

/** Thông báo cho khách: các mốc tiến độ, báo giá đang chờ xác nhận và nhắc nhở (PARAM-18). */
export function buildNotifications(cases: WarrantyCase[], phone: string, now: number, cal: WorkCalendar, limit = 5): Notification[] {
  const list: Notification[] = [];
  for (const c of casesOfPhone(cases, phone)) {
    for (const e of c.events) list.push({ at: e.at, text: `Phiếu ${c.code}: ${PUBLIC_STEPS[e.step]}` });
    const q = c.quote;
    if (c.status === 'QUOTED' && q && q.status === 'SENT' && q.sentAt !== null) {
      list.push({ at: q.sentAt, text: `Phiếu ${c.code}: báo giá đang chờ bạn xác nhận` });
      for (const t of quoteReminderTimes(q, now, cal)) list.push({ at: t, text: `Nhắc: phiếu ${c.code} vẫn đang chờ bạn xác nhận báo giá` });
    }
  }
  return list.sort((a, b) => b.at - a.at).slice(0, limit);
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

/** Bảo hành sau sửa chữa: 6 tháng kể từ ngày bàn giao, chỉ khi phiếu đã hoàn thành và có thay linh kiện (PARAM-01). */
export function postRepairWarrantyUntil(c: WarrantyCase): number | null {
  const handover = c.events.at(-1)?.at;
  if (c.status !== 'COMPLETED' || c.parts.length === 0 || handover === undefined) return null;
  return addMonths(handover, POST_REPAIR_WARRANTY_MONTHS);
}

/** Lịch sử của đúng thiết bị này (cùng serial). Chỉ gồm phiếu của chính số điện thoại đó để không lộ dữ liệu người khác (FR-17, BR-27). */
export function deviceHistory(cases: WarrantyCase[], c: WarrantyCase): HistoryEntry[] {
  return cases
    .filter((x) => x.serial === c.serial && x.phone === c.phone)
    .sort((a, b) => b.receivedAt - a.receivedAt)
    .map((x) => ({ code: x.code, receivedAt: x.receivedAt, status: x.status, parts: x.status === 'COMPLETED' ? x.parts : [], warrantyUntil: postRepairWarrantyUntil(x) }));
}

/** Phiếu của các thiết bị khác cùng số điện thoại. */
export const otherDeviceCases = (cases: WarrantyCase[], c: WarrantyCase) =>
  cases.filter((x) => x.phone === c.phone && x.serial !== c.serial);
