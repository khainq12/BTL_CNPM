import { FINAL_STATUSES, WAITING_CUSTOMER_STATUSES } from '../constants';
import type { CaseStatus, SlaInstance, SlaState, WarrantyCase, WorkCalendar } from '../types';
import { addWorkingMinutes, workingMinutesBetween } from './calendar';

export const DEFAULT_WARN_RATIO = 0.75; // SRS FR-14: cờ vàng tại 75%

/**
 * Thời điểm SLA đạt `minutes` phút làm việc đã dùng, không tính các khoảng tạm dừng.
 * Lặp vài lần vì độ dài phần tạm dừng phụ thuộc vào chính thời điểm tìm được.
 */
export function timeAtUsedMinutes(sla: SlaInstance, minutes: number, ref: number, cal: WorkCalendar): number | null {
  let paused = 0;
  let t: number | null = null;
  for (let k = 0; k < 4; k++) {
    t = addWorkingMinutes(sla.start, minutes + paused, cal);
    if (t === null) return null;
    const limit = t;
    paused = sla.pauses.reduce((sum, p) => sum + workingMinutesBetween(p.from, Math.min(p.to ?? ref, limit), cal), 0);
  }
  return t;
}

export interface SlaEvaluation {
  elapsed: number;   // phút làm việc đã dùng (đã trừ tạm dừng)
  ratio: number;     // elapsed / mục tiêu
  remaining: number; // phút còn lại, âm nếu đã quá hạn
  state: SlaState;
  deadline: number | null;
}

/** Đã hoàn tất thì đồng hồ dừng tại `end`. Đúng bằng hạn vẫn tính là đúng hạn. */
export function evaluateSla(sla: SlaInstance, now: number, cal: WorkCalendar, warnRatio = DEFAULT_WARN_RATIO): SlaEvaluation {
  const ref = sla.end ?? now;
  const target = sla.targetHours * 60;
  const open = sla.end === null && sla.pauses.some((p) => p.to === null);
  const pausedWork = sla.pauses.reduce((s, p) => s + workingMinutesBetween(p.from, Math.min(p.to ?? ref, ref), cal), 0);
  const elapsed = Math.max(0, workingMinutesBetween(sla.start, ref, cal) - pausedWork);
  const ratio = elapsed / target;
  let state: SlaState;
  if (sla.end !== null) state = elapsed > target ? 'LATE' : 'DONE';
  else if (ratio > 1) state = 'BREACH';
  else if (open) state = 'PAUSED';
  else if (ratio >= warnRatio) state = 'WARN';
  else state = 'OK';
  return { elapsed, ratio, remaining: target - elapsed, state, deadline: timeAtUsedMinutes(sla, target, ref, cal) };
}

export interface HistoryRow { at: number; sla: string; text: string }

/** Lịch sử SLA của một Case (TV7-12), suy ra từ dữ liệu SLA nên luôn khớp với bộ tính. */
export function buildSlaHistory(c: WarrantyCase, now: number, cal: WorkCalendar, warnRatio = DEFAULT_WARN_RATIO): HistoryRow[] {
  const rows: HistoryRow[] = [];
  for (const s of c.sla) {
    const ref = s.end ?? now;
    const target = s.targetHours * 60;
    const r = evaluateSla(s, now, cal, warnRatio);
    rows.push({ at: s.start, sla: s.code, text: 'Bắt đầu đếm' });
    for (const p of s.pauses) {
      rows.push({ at: p.from, sla: s.code, text: `Tạm dừng: ${p.reason}` });
      if (p.to !== null) rows.push({ at: p.to, sla: s.code, text: 'Tiếp tục' });
    }
    if (r.elapsed >= warnRatio * target) {
      const t = timeAtUsedMinutes(s, warnRatio * target, ref, cal);
      if (t !== null) rows.push({ at: t, sla: s.code, text: `Cảnh báo: đã dùng ${Math.round(warnRatio * 100)}% thời hạn` });
    }
    if (r.elapsed > target) {
      const t = timeAtUsedMinutes(s, target, ref, cal);
      if (t !== null) rows.push({ at: t, sla: s.code, text: 'Ghi nhận vi phạm thời hạn' });
    }
    if (s.end !== null) rows.push({ at: s.end, sla: s.code, text: `Hoàn tất (${r.state === 'LATE' ? 'trễ hạn' : 'đúng hạn'})` });
  }
  return rows.sort((a, b) => a.at - b.at);
}

export interface DashboardStats {
  total: number;
  inProgress: number;
  waitingCustomer: number;
  completed: number;
  nearDeadline: number;
  overdue: number;
  /** null khi chưa có mốc SLA nào hoàn tất, tránh chia cho 0. */
  onTimeRate: number | null;
  byStatus: Partial<Record<CaseStatus, number>>;
}

export function computeStats(cases: WarrantyCase[], now: number, cal: WorkCalendar, warnRatio = DEFAULT_WARN_RATIO): DashboardStats {
  const s: DashboardStats = { total: cases.length, inProgress: 0, waitingCustomer: 0, completed: 0, nearDeadline: 0, overdue: 0, onTimeRate: null, byStatus: {} };
  let onTime = 0;
  let late = 0;
  for (const c of cases) {
    s.byStatus[c.status] = (s.byStatus[c.status] ?? 0) + 1;
    const final = FINAL_STATUSES.includes(c.status);
    if (final) s.completed++;
    else if (WAITING_CUSTOMER_STATUSES.includes(c.status)) s.waitingCustomer++;
    else s.inProgress++;
    for (const sla of c.sla) {
      const st = evaluateSla(sla, now, cal, warnRatio).state;
      if (st === 'DONE') onTime++;
      if (st === 'LATE') late++;
    }
    const last = c.sla.at(-1);
    if (last && !final) {
      const st = evaluateSla(last, now, cal, warnRatio).state;
      if (st === 'WARN') s.nearDeadline++;
      if (st === 'BREACH') s.overdue++;
    }
  }
  if (onTime + late > 0) s.onTimeRate = onTime / (onTime + late);
  return s;
}
