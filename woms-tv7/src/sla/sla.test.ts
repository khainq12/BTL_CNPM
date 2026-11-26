import { describe, expect, it } from 'vitest';
import { DEFAULT_CALENDAR } from '../constants';
import type { SlaInstance, WarrantyCase, WorkCalendar } from '../types';
import { addMonths, addWorkingMinutes, elapsedWorkingDays, workdayMinutes, workingMinutesBetween } from './calendar';
import { buildSlaHistory, computeStats, evaluateSla } from './engine';

const D = (m: number, d: number, h = 0, mi = 0) => new Date(2026, m - 1, d, h, mi).getTime();

/** Lịch của hồ sơ khảo sát v0.2: 08:00–17:00, nghỉ trưa 12:00–13:00, Thứ Hai–Sáu. */
const SURVEY: WorkCalendar = { startMin: 480, endMin: 1020, days: [1, 2, 3, 4, 5], lunch: [720, 780], holidays: [] };
const sla = (hours: number, start: number, end: number | null = null, pauses: SlaInstance['pauses'] = []): SlaInstance =>
  ({ code: 'SLA-03', targetHours: hours, start, end, pauses });

describe('Deadline Calculator (TV7-08)', () => {
  it('ví dụ khảo sát: 16 giờ từ 08:00 thứ Hai ra 17:00 thứ Ba', () => {
    expect(addWorkingMinutes(D(11, 9, 8), 16 * 60, SURVEY)).toBe(D(11, 10, 17));
  });
  it('qua cuối tuần: thứ Sáu 16:00 + 2 giờ = thứ Hai 09:00', () => {
    expect(addWorkingMinutes(D(11, 13, 16), 120, SURVEY)).toBe(D(11, 16, 9));
  });
  it('qua ngày lễ: nghỉ thứ Hai thì hạn là thứ Ba 09:00', () => {
    expect(addWorkingMinutes(D(11, 13, 16), 120, { ...SURVEY, holidays: ['2026-11-16'] })).toBe(D(11, 17, 9));
  });
  it('biên giờ nghỉ trưa: 11:30 + 1 giờ = 13:30', () => {
    expect(addWorkingMinutes(D(11, 9, 11, 30), 60, SURVEY)).toBe(D(11, 9, 13, 30));
  });
  it('lịch mặc định theo SRS có làm Thứ Bảy', () => {
    expect(addWorkingMinutes(D(11, 13, 16), 120, DEFAULT_CALENDAR)).toBe(D(11, 14, 8, 30));
  });
  it('lịch không có ngày làm việc trả về null thay vì lặp vô hạn', () => {
    expect(addWorkingMinutes(D(11, 9, 8), 60, { ...SURVEY, days: [] })).toBeNull();
  });
  it('workingMinutesBetween khớp addWorkingMinutes', () => {
    const end = addWorkingMinutes(D(11, 9, 10), 600, SURVEY)!;
    expect(workingMinutesBetween(D(11, 9, 10), end, SURVEY)).toBe(600);
  });
});

describe('SLA Monitoring / Warning / Breach (TV7-09, 10, 11)', () => {
  const s = sla(2, D(11, 10, 8));
  it('dưới ngưỡng: đúng tiến độ', () => expect(evaluateSla(s, D(11, 10, 9, 29), SURVEY).state).toBe('OK'));
  it('đúng 75%: cảnh báo', () => expect(evaluateSla(s, D(11, 10, 9, 30), SURVEY).state).toBe('WARN'));
  it('đúng bằng hạn: chưa tính là quá hạn', () => expect(evaluateSla(s, D(11, 10, 10), SURVEY).state).toBe('WARN'));
  it('vượt hạn: vi phạm và có dòng lịch sử', () => {
    expect(evaluateSla(s, D(11, 10, 10, 1), SURVEY).state).toBe('BREACH');
    const c = { sla: [s] } as WarrantyCase;
    expect(buildSlaHistory(c, D(11, 10, 10, 1), SURVEY).some((h) => h.text.startsWith('Ghi nhận vi phạm'))).toBe(true);
  });
  it('ngưỡng cảnh báo cấu hình được', () => {
    expect(evaluateSla(s, D(11, 10, 9), SURVEY, 0.5).state).toBe('WARN');
  });
});

describe('Pause / Resume / Complete (TV7-12)', () => {
  it('tạm dừng 1 giờ làm việc lùi hạn 1 giờ', () => {
    const s = sla(2, D(11, 9, 8), null, [{ from: D(11, 9, 9), to: D(11, 9, 10), kind: 'QUOTE_WAIT', reason: 't' }]);
    expect(evaluateSla(s, D(11, 9, 9, 30), SURVEY).deadline).toBe(D(11, 9, 11));
  });
  it('tạm dừng ngoài giờ làm không lùi hạn', () => {
    const s = sla(2, D(11, 9, 8), null, [{ from: D(11, 9, 18), to: D(11, 10, 7), kind: 'QUOTE_WAIT', reason: 't' }]);
    expect(evaluateSla(s, D(11, 9, 9), SURVEY).deadline).toBe(D(11, 9, 10));
  });
  it('đang tạm dừng thì không tăng thời gian đã dùng', () => {
    const s = sla(2, D(11, 9, 8), null, [{ from: D(11, 9, 9), to: null, kind: 'QUOTE_WAIT', reason: 't' }]);
    const a = evaluateSla(s, D(11, 9, 10), SURVEY);
    expect(a.state).toBe('PAUSED');
    expect(evaluateSla(s, D(11, 9, 16), SURVEY).elapsed).toBe(a.elapsed);
  });
  it('hoàn tất: đồng hồ dừng tại thời điểm kết thúc', () => {
    const s = sla(2, D(11, 9, 8), D(11, 9, 9));
    expect(evaluateSla(s, D(11, 9, 10), SURVEY).elapsed).toBe(60);
    expect(evaluateSla(s, D(11, 12, 10), SURVEY).elapsed).toBe(60);
    expect(evaluateSla(s, D(11, 12, 10), SURVEY).state).toBe('DONE');
  });
  it('hoàn tất sau hạn: ghi nhận trễ', () => {
    expect(evaluateSla(sla(1, D(11, 9, 8), D(11, 9, 10)), D(11, 9, 12), SURVEY).state).toBe('LATE');
  });
});

describe('Dashboard (không chia cho 0)', () => {
  it('0 case: mọi số là 0, tỷ lệ là null', () => {
    const st = computeStats([], D(11, 11, 14), DEFAULT_CALENDAR);
    expect(st).toMatchObject({ total: 0, inProgress: 0, waitingCustomer: 0, completed: 0, nearDeadline: 0, overdue: 0, onTimeRate: null });
  });
});

describe('Giới hạn tạm dừng (BR-26, PARAM-16, PARAM-17)', () => {
  // SURVEY: một ngày làm việc = 8 giờ (08:00–17:00 trừ nghỉ trưa 1 giờ).
  const start = D(11, 9, 8); // thứ Hai
  const parts = (to: number | null) => ({ from: D(11, 9, 9), to, kind: 'WAITING_PARTS' as const, reason: 'Chờ linh kiện' });

  it('một ngày làm việc của lịch khảo sát là 8 giờ', () => expect(workdayMinutes(SURVEY)).toBe(480));
  it('chờ linh kiện 33 giờ làm việc: chỉ trừ tối đa 3 ngày (24 giờ), phần vượt tính vào xử lý', () => {
    const s = sla(24, start, null, [parts(D(11, 13, 9))]);
    // Từ thứ Hai 08:00 đến thứ Sáu 09:00 có 33 giờ làm việc; tạm dừng thô 32 giờ, được công nhận 24 giờ.
    expect(evaluateSla(s, D(11, 13, 9), SURVEY).elapsed).toBe(9 * 60);
  });
  it('lý do không có trần (chờ báo giá lần đầu) thì trừ toàn bộ', () => {
    const s = sla(24, start, null, [{ from: D(11, 9, 9), to: D(11, 13, 9), kind: 'QUOTE_WAIT', reason: 't' }]);
    expect(evaluateSla(s, D(11, 13, 9), SURVEY).elapsed).toBe(60);
  });
  it('xác nhận lại báo giá có trần 5 ngày', () => {
    const s = sla(24, start, null, [{ from: D(11, 9, 9), to: D(11, 13, 9), kind: 'QUOTE_RECONFIRM', reason: 't' }]);
    expect(evaluateSla(s, D(11, 13, 9), SURVEY).elapsed).toBe(60); // 32 giờ < 5 ngày nên vẫn trừ hết
  });
  it('còn trong trần thì trạng thái là tạm dừng, quá trần thì đồng hồ chạy lại', () => {
    const s = sla(24, start, null, [parts(null)]);
    expect(evaluateSla(s, D(11, 12, 8, 30), SURVEY).state).toBe('PAUSED');
    const after = evaluateSla(s, D(11, 12, 10), SURVEY);
    expect(after.pauseExpired).toBe(true);
    expect(after.state).toBe('OK');
    expect(after.elapsed).toBe(2 * 60);
  });
  it('lịch sử có dòng hết thời hạn tạm dừng', () => {
    const c = { sla: [sla(24, start, null, [parts(null)])] } as WarrantyCase;
    const rows = buildSlaHistory(c, D(11, 12, 10), SURVEY);
    expect(rows.some((r) => r.text.startsWith('Hết thời hạn tạm dừng'))).toBe(true);
  });
  it('hạn xử lý lùi theo phần tạm dừng được công nhận, không lùi theo phần vượt trần', () => {
    const s = sla(8, start, null, [parts(D(11, 13, 9))]);
    // 8 giờ làm việc + 24 giờ tạm dừng được công nhận = 32 giờ kể từ thứ Hai 08:00 = thứ Năm 17:00.
    expect(evaluateSla(s, D(11, 13, 9), SURVEY).deadline).toBe(D(11, 12, 17));
  });
});

describe('Tiện ích lịch', () => {
  it('đếm ngày làm việc trọn vẹn', () => {
    expect(elapsedWorkingDays(D(11, 9, 8), D(11, 11, 8), SURVEY)).toBe(2);
    expect(elapsedWorkingDays(D(11, 9, 8), D(11, 10, 16), SURVEY)).toBe(1); // 15 giờ chưa đủ 2 ngày
  });
  it('cộng tháng và lùi về ngày cuối tháng khi cần', () => {
    expect(addMonths(D(10, 20, 9), 6)).toBe(D(10 + 6, 20, 9));
    expect(addMonths(new Date(2026, 7, 31, 9, 0).getTime(), 6)).toBe(new Date(2027, 1, 28, 9, 0).getTime());
  });
});
