import { describe, expect, it } from 'vitest';
import { DEFAULT_CALENDAR } from '../constants';
import { DEMO_NOW, SEED_CASES } from '../data/seed';
import { approveQuote, createQuote, needsManagerApproval, quoteReminderTimes, quoteTotal, toPublicQuote } from './quoteService';
import { lookupPublic, respondToQuote } from './portalService';

const D = (m: number, d: number, h = 0, mi = 0) => new Date(2026, m - 1, d, h, mi).getTime();
const byCode = (code: string) => SEED_CASES.find((c) => c.code === code)!;

describe('Báo giá (BR-07, PARAM-03)', () => {
  it('đúng bằng ngưỡng 2.000.000 thì không cần quản lý duyệt', () => {
    expect(needsManagerApproval({ parts: 1_500_000, labor: 500_000 })).toBe(false);
    expect(createQuote(1_500_000, 500_000, DEMO_NOW).status).toBe('SENT');
  });
  it('vượt ngưỡng 1 đồng thì phải chờ quản lý duyệt, chưa gửi khách', () => {
    const q = createQuote(1_500_000, 500_001, DEMO_NOW);
    expect(q.status).toBe('PENDING_MANAGER');
    expect(q.sentAt).toBeNull();
  });
  it('tổng báo giá gồm linh kiện và tiền công', () => {
    expect(quoteTotal({ parts: 950_000, labor: 300_000 })).toBe(1_250_000);
  });
});

describe('Báo giá trên Customer Portal', () => {
  it('báo giá đã gửi hiện chi tiết linh kiện, tiền công, tổng', () => {
    expect(toPublicQuote(byCode('CAS-20261111-0006'))).toEqual({ parts: 950_000, labor: 300_000, total: 1_250_000 });
  });
  it('báo giá chờ quản lý duyệt: khách không thấy số tiền', () => {
    const c = byCode('CAS-20261111-0010');
    expect(toPublicQuote(c)).toBeNull();
    const v = lookupPublic(SEED_CASES, c.code, c.phone);
    expect(v?.quote).toBeNull();
    expect(v?.note).toContain('hoàn tất báo giá');
  });
  it('khách không thể xác nhận báo giá chưa được duyệt', () => {
    const c = byCode('CAS-20261111-0010');
    expect(respondToQuote(c, true, DEMO_NOW)).toBe(c);
  });
  it('sau khi quản lý duyệt: gửi cho khách và SLA chẩn đoán tạm dừng chờ phản hồi', () => {
    const next = approveQuote(byCode('CAS-20261111-0010'), DEMO_NOW);
    expect(next.quote?.status).toBe('SENT');
    expect(next.quote?.sentAt).toBe(DEMO_NOW);
    expect(next.sla.at(-1)?.pauses.some((p) => p.to === null && p.kind === 'QUOTE_WAIT')).toBe(true);
    expect(toPublicQuote(next)?.total).toBe(2_500_000);
  });
  it('duyệt hai lần không tạo thêm khoảng tạm dừng', () => {
    const once = approveQuote(byCode('CAS-20261111-0010'), DEMO_NOW);
    expect(approveQuote(once, DEMO_NOW + 1)).toBe(once);
  });
  it('khách đồng ý hoặc từ chối: trạng thái báo giá được ghi nhận', () => {
    expect(respondToQuote(byCode('CAS-20261111-0006'), true, DEMO_NOW).quote?.status).toBe('ACCEPTED');
    expect(respondToQuote(byCode('CAS-20261111-0006'), false, DEMO_NOW).quote?.status).toBe('REJECTED');
  });
});

describe('Nhắc khách xác nhận báo giá (PARAM-18)', () => {
  const q = byCode('CAS-20261111-0006').quote!; // gửi lúc 10:30 thứ Tư 11/11, lịch mặc định 9,5 giờ mỗi ngày
  it('chưa đến 2 ngày làm việc thì chưa nhắc', () => expect(quoteReminderTimes(q, D(11, 13, 10), DEFAULT_CALENDAR)).toEqual([]));
  it('sau 2 ngày làm việc nhắc lần 1', () => expect(quoteReminderTimes(q, D(11, 14, 12), DEFAULT_CALENDAR)).toHaveLength(1));
  it('sau 4 ngày làm việc nhắc lần 2', () => expect(quoteReminderTimes(q, D(11, 17, 12), DEFAULT_CALENDAR)).toHaveLength(2));
});
