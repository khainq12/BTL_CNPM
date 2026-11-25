import type { WorkCalendar } from '../types';

const MINUTE = 60_000;
const MAX_DAYS = 800; // chặn vòng lặp vô hạn khi lịch không có ngày làm việc nào

const pad = (n: number) => String(n).padStart(2, '0');

export const dateKey = (t: number): string => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const startOfDay = (t: number): number => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};
export const startOfNextDay = (t: number): number => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
};

/** Các khoảng giờ làm việc [bắt đầu, kết thúc) của ngày chứa t. Rỗng nếu là ngày nghỉ hoặc ngày lễ. */
export function workWindows(t: number, cal: WorkCalendar): Array<[number, number]> {
  const base = startOfDay(t);
  if (!cal.days.includes(new Date(base).getDay()) || cal.holidays.includes(dateKey(base))) return [];
  const at = (m: number) => base + m * MINUTE;
  return cal.lunch
    ? [[at(cal.startMin), at(cal.lunch[0])], [at(cal.lunch[1]), at(cal.endMin)]]
    : [[at(cal.startMin), at(cal.endMin)]];
}

/** Thời điểm đạt đủ `minutes` phút làm việc kể từ `start`. Trả null nếu lịch không có ngày làm việc. */
export function addWorkingMinutes(start: number, minutes: number, cal: WorkCalendar): number | null {
  let t = start;
  let remaining = minutes;
  for (let i = 0; i < MAX_DAYS; i++) {
    for (const [w0, w1] of workWindows(t, cal)) {
      const s = Math.max(t, w0);
      if (s < w1) {
        const available = (w1 - s) / MINUTE;
        if (remaining <= available) return s + remaining * MINUTE;
        remaining -= available;
      }
    }
    t = startOfNextDay(t);
  }
  return null;
}

/** Số phút làm việc nằm trong khoảng [a, b]. */
export function workingMinutesBetween(a: number, b: number, cal: WorkCalendar): number {
  if (b <= a) return 0;
  let t = startOfDay(a);
  let sum = 0;
  for (let i = 0; i < MAX_DAYS && t < b; i++) {
    for (const [w0, w1] of workWindows(t, cal)) {
      const overlap = Math.min(b, w1) - Math.max(a, w0);
      if (overlap > 0) sum += overlap / MINUTE;
    }
    t = startOfNextDay(t);
  }
  return sum;
}
