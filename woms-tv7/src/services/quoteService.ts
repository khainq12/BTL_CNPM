import { PAUSE_LABEL, QUOTE_APPROVAL_THRESHOLD, QUOTE_REMINDER_DAYS } from '../constants';
import { addWorkingMinutes, workdayMinutes } from '../sla/calendar';
import type { PublicQuote, Quote, WarrantyCase, WorkCalendar } from '../types';

export const quoteTotal = (q: Pick<Quote, 'parts' | 'labor'>) => q.parts + q.labor;

/** BR-07: chỉ báo giá lớn hơn ngưỡng mới cần quản lý duyệt. Đúng bằng ngưỡng thì không. */
export const needsManagerApproval = (q: Pick<Quote, 'parts' | 'labor'>) => quoteTotal(q) > QUOTE_APPROVAL_THRESHOLD;

/** Báo giá mới: vượt ngưỡng thì chờ quản lý duyệt, chưa gửi khách. */
export function createQuote(parts: number, labor: number, now: number): Quote {
  return needsManagerApproval({ parts, labor })
    ? { parts, labor, status: 'PENDING_MANAGER', sentAt: null }
    : { parts, labor, status: 'SENT', sentAt: now };
}

/** Quản lý duyệt: báo giá được gửi cho khách và SLA chẩn đoán tạm dừng để chờ khách phản hồi (SRS B.6). */
export function approveQuote(c: WarrantyCase, now: number): WarrantyCase {
  if (!c.quote || c.quote.status !== 'PENDING_MANAGER') return c;
  const last = c.sla.at(-1);
  const sla = last && last.code === 'SLA-02' && last.end === null && !last.pauses.some((p) => p.to === null)
    ? [...c.sla.slice(0, -1), { ...last, pauses: [...last.pauses, { from: now, to: null, kind: 'QUOTE_WAIT' as const, reason: PAUSE_LABEL.QUOTE_WAIT }] }]
    : c.sla;
  return { ...c, sla, quote: { ...c.quote, status: 'SENT', sentAt: now } };
}

/** Khách chỉ thấy báo giá đã gửi và đang chờ mình xác nhận. */
export function toPublicQuote(c: WarrantyCase): PublicQuote | null {
  const q = c.quote;
  if (c.status !== 'QUOTED' || !q || q.status !== 'SENT') return null;
  return { parts: q.parts, labor: q.labor, total: quoteTotal(q) };
}

/** Các thời điểm nhắc khách (sau 2 và 4 ngày làm việc) đã đến hạn tính đến `now`. */
export function quoteReminderTimes(q: Quote, now: number, cal: WorkCalendar): number[] {
  if (q.status !== 'SENT' || q.sentAt === null) return [];
  const day = workdayMinutes(cal);
  return QUOTE_REMINDER_DAYS
    .map((d) => addWorkingMinutes(q.sentAt as number, d * day, cal))
    .filter((t): t is number => t !== null && t <= now);
}
