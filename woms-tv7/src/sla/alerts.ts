import { QUOTE_NO_REPLY_DAYS } from '../constants';
import type { AlertKind, AlertStatus, Role, SlaAlert, WarrantyCase, WorkCalendar } from '../types';
import { addWorkingMinutes, workdayMinutes } from './calendar';
import { DEFAULT_WARN_RATIO, evaluateSla, pauseCapMinutes, timeAtUsedMinutes } from './engine';

export const ALERT_LABEL: Record<AlertKind, string> = {
  SLA_WARN: 'Sắp quá hạn',
  SLA_BREACH: 'Quá hạn',
  PARTS_WAIT_LIMIT: 'Chờ linh kiện quá giới hạn',
  QUOTE_NO_REPLY: 'Khách chưa phản hồi báo giá',
};
export const ROLE_LABEL: Record<Role, string> = { COORDINATOR: 'Điều phối viên', MANAGER: 'Quản lý', CSKH: 'Nhân viên CSKH' };

/** Người nhận theo BR-25 (cảnh báo hạn), PARAM-15 (chờ linh kiện) và PARAM-04 (báo giá không phản hồi). */
const RECIPIENTS: Record<AlertKind, Role[]> = {
  SLA_WARN: ['COORDINATOR', 'MANAGER'],
  SLA_BREACH: ['COORDINATOR', 'MANAGER'],
  PARTS_WAIT_LIMIT: ['COORDINATOR', 'MANAGER'],
  QUOTE_NO_REPLY: ['CSKH'],
};

/**
 * Cảnh báo được suy ra từ trạng thái SLA, nên cùng một dữ liệu luôn cho cùng một danh sách và không bị trùng.
 * Cảnh báo của SLA đã hoàn tất hoặc linh kiện đã về được tự đóng.
 */
export function deriveAlerts(cases: WarrantyCase[], now: number, cal: WorkCalendar, warnRatio = DEFAULT_WARN_RATIO): SlaAlert[] {
  const out: SlaAlert[] = [];
  const add = (id: string, c: WarrantyCase, slaCode: SlaAlert['slaCode'], kind: AlertKind, raisedAt: number | null, autoClosed: string | null) => {
    if (raisedAt === null) return;
    out.push({
      id, caseCode: c.code, slaCode, kind, raisedAt, recipients: RECIPIENTS[kind],
      status: autoClosed ? 'HANDLED' : 'OPEN', result: autoClosed ?? '',
    });
  };

  for (const c of cases) {
    for (const s of c.sla) {
      const ref = s.end ?? now;
      const target = s.targetHours * 60;
      const r = evaluateSla(s, now, cal, warnRatio);
      const done = s.end !== null ? `SLA đã hoàn tất (${r.state === 'LATE' ? 'trễ hạn' : 'đúng hạn'})` : null;

      if (r.elapsed >= warnRatio * target) add(`${c.code}:${s.code}:SLA_WARN`, c, s.code, 'SLA_WARN', timeAtUsedMinutes(s, warnRatio * target, ref, cal), done);
      if (r.elapsed > target) add(`${c.code}:${s.code}:SLA_BREACH`, c, s.code, 'SLA_BREACH', timeAtUsedMinutes(s, target, ref, cal), done);

      for (const p of s.pauses) {
        if (p.kind !== 'WAITING_PARTS') continue;
        const capAt = addWorkingMinutes(p.from, pauseCapMinutes(p.kind, cal), cal);
        const exceeded = capAt !== null && (p.to === null ? capAt <= ref : capAt < p.to);
        if (exceeded) add(`${c.code}:${s.code}:PARTS_WAIT_LIMIT:${p.from}`, c, s.code, 'PARTS_WAIT_LIMIT', capAt, p.to !== null ? 'Linh kiện đã về, công việc tiếp tục' : null);
      }
    }
    const q = c.quote;
    if (c.status === 'QUOTED' && q && q.status === 'SENT' && q.sentAt !== null) {
      const t = addWorkingMinutes(q.sentAt, QUOTE_NO_REPLY_DAYS * workdayMinutes(cal), cal);
      if (t !== null && t <= now) add(`${c.code}:QUOTE_NO_REPLY`, c, null, 'QUOTE_NO_REPLY', t, null);
    }
  }
  return out.sort((a, b) => b.raisedAt - a.raisedAt);
}

export type AlertCommand = 'COORDINATOR_DONE' | 'ESCALATE' | 'MANAGER_DONE' | 'CSKH_DONE';
export interface AlertAction { status: AlertStatus; result: string; at: number }

export function commandToAction(cmd: AlertCommand, at: number): AlertAction {
  switch (cmd) {
    case 'COORDINATOR_DONE': return { status: 'HANDLED', result: 'Điều phối viên đã xử lý', at };
    case 'ESCALATE': return { status: 'ESCALATED', result: 'Vượt thẩm quyền điều phối, đã chuyển quản lý', at };
    case 'MANAGER_DONE': return { status: 'HANDLED', result: 'Quản lý đã chỉ đạo xử lý', at };
    case 'CSKH_DONE': return { status: 'HANDLED', result: 'CSKH đã liên hệ khách', at };
  }
}

/** Gộp thao tác xử lý của người dùng lên danh sách cảnh báo suy ra. Cảnh báo đã tự đóng thì giữ nguyên. */
export function applyAlertActions(alerts: SlaAlert[], actions: Record<string, AlertAction>): SlaAlert[] {
  return alerts.map((a) => {
    const act = actions[a.id];
    if (!act || a.status === 'HANDLED') return a;
    const recipients: Role[] = act.status === 'ESCALATED' && !a.recipients.includes('MANAGER') ? [...a.recipients, 'MANAGER'] : a.recipients;
    return { ...a, status: act.status, result: act.result, recipients };
  });
}

/** Thao tác được phép trên một cảnh báo (RACI 5.4): điều phối viên xử lý hoặc chuyển quản lý, quản lý xử lý phần đã chuyển, CSKH xử lý báo giá không phản hồi. */
export function allowedAlertCommands(a: SlaAlert): AlertCommand[] {
  if (a.status === 'HANDLED') return [];
  if (a.kind === 'QUOTE_NO_REPLY') return ['CSKH_DONE'];
  if (a.status === 'ESCALATED') return ['MANAGER_DONE'];
  return ['COORDINATOR_DONE', 'ESCALATE'];
}
