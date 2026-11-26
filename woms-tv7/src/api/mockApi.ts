import { DEFAULT_CALENDAR, DEFAULT_POLICY, FINAL_STATUSES, PAUSE_OPTIONS } from '../constants';
import { DEMO_NOW, SEED_CASES } from '../data/seed';
import {
  DEMO_OTP, MAX_FAILED_LOOKUPS, buildNotifications, deviceHistory, findCase, otherDeviceCases, publicEta, respondToQuote, toPublicCase,
} from '../services/portalService';
import { approveQuote, quoteTotal } from '../services/quoteService';
import { finishLatest, pauseLatest, resumeLatest } from '../sla/actions';
import { allowedAlertCommands, applyAlertActions, commandToAction, deriveAlerts, type AlertAction, type AlertCommand } from '../sla/alerts';
import { addWorkingMinutes } from '../sla/calendar';
import { DEFAULT_WARN_RATIO, buildSlaHistory, computeStats, evaluateSla } from '../sla/engine';
import type { PauseKind, SlaCode, WarrantyCase, WorkCalendar } from '../types';
import {
  ApiError, type AlertView, type CaptchaChallenge, type DashboardView, type LookupResult, type PortalCaseView, type SlaRow, type SlaSettings,
  type SlaSettingsPatch, type WomsApi,
} from './contract';

/** Bản giả lập "server" chạy trong trình duyệt. Mọi quy tắc nằm ở đây, giao diện không tự tính. */
export function createMockApi(initialCases: WarrantyCase[] = SEED_CASES): WomsApi {
  let cases = initialCases;
  let now = DEMO_NOW;
  let empty = false;
  let settings: SlaSettings = { policy: DEFAULT_POLICY, warnRatio: DEFAULT_WARN_RATIO, calendar: DEFAULT_CALENDAR };
  const actions: Record<string, AlertAction> = {};
  const sessions = new Map<string, string>(); // token -> số điện thoại
  let seq = 0;
  let failed = 0;
  let challenge: { id: string; a: number; b: number } | null = null;

  const newChallenge = () => {
    challenge = { id: `ch-${++seq}`, a: 2 + Math.floor(Math.random() * 7), b: 2 + Math.floor(Math.random() * 7) };
    return challenge;
  };
  const publicChallenge = (c: { id: string; a: number; b: number }): CaptchaChallenge => ({ id: c.id, prompt: `${c.a} + ${c.b} =` });

  const replace = (code: string, fn: (c: WarrantyCase) => WarrantyCase) => { cases = cases.map((c) => (c.code === code ? fn(c) : c)); };
  const getCase = (code: string): WarrantyCase => {
    const c = cases.find((x) => x.code === code);
    if (!c) throw new ApiError('NOT_FOUND', 'Không tìm thấy phiếu.');
    return c;
  };

  const view = (c: WarrantyCase): PortalCaseView => ({
    case: toPublicCase(c),
    eta: publicEta(c, now, settings.calendar, settings.warnRatio),
    history: deviceHistory(cases, c),
    otherDevices: otherDeviceCases(cases, c).map((x) => ({ code: x.code, device: x.device, receivedAt: x.receivedAt, status: x.status })),
    notifications: buildNotifications(cases, c.phone, now, settings.calendar),
  });

  /** Phiếu của đúng số điện thoại trong phiên. Phiếu của người khác trả NOT_FOUND giống phiếu không tồn tại. */
  const ownCase = (session: string, code: string): WarrantyCase => {
    const phone = sessions.get(session);
    if (!phone) throw new ApiError('FORBIDDEN', 'Phiên tra cứu không hợp lệ.');
    const c = cases.find((x) => x.code === code.trim().toUpperCase() && x.phone === phone);
    if (!c) throw new ApiError('NOT_FOUND', 'Không tìm thấy phiếu phù hợp.');
    return c;
  };

  const row = (c: WarrantyCase): SlaRow => {
    const s = c.sla.at(-1);
    if (!s) throw new ApiError('INVALID_STATE', 'Phiếu chưa có SLA.');
    const r = evaluateSla(s, now, settings.calendar, settings.warnRatio);
    return {
      caseCode: c.code, caseStatus: c.status, slaCode: s.code, start: s.start, deadline: r.deadline, remainingMinutes: r.remaining,
      ratio: r.ratio, state: r.state, pauseExpired: r.pauseExpired, ended: s.end !== null,
      paused: s.pauses.some((p) => p.to === null), pauseOptions: PAUSE_OPTIONS[s.code],
    };
  };

  const alertViews = (): AlertView[] =>
    applyAlertActions(deriveAlerts(cases, now, settings.calendar, settings.warnRatio), actions)
      .map((a) => ({ ...a, commands: allowedAlertCommands(a) }));

  const validateCalendar = (c: WorkCalendar) => {
    const bad = (m: string) => { throw new ApiError('VALIDATION', m); };
    if (!(c.startMin >= 0 && c.endMin <= 1440 && c.endMin > c.startMin)) bad('Giờ kết thúc phải sau giờ bắt đầu.');
    if (c.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) bad('Ngày làm việc không hợp lệ.');
    if (c.lunch && !(c.lunch[0] >= c.startMin && c.lunch[1] <= c.endMin && c.lunch[0] < c.lunch[1])) bad('Giờ nghỉ trưa phải nằm trong giờ làm việc.');
    if (c.holidays.some((h) => !/^\d{4}-\d{2}-\d{2}$/.test(h))) bad('Ngày nghỉ lễ phải có dạng YYYY-MM-DD.');
  };

  return {
    /* ---- Portal ---- */
    async lookup({ code, phone, captcha }): Promise<LookupResult> {
      if (failed >= MAX_FAILED_LOOKUPS) {
        if (!captcha || !challenge) return { ok: false, reason: 'CAPTCHA_REQUIRED', challenge: publicChallenge(challenge ?? newChallenge()) };
        if (captcha.id !== challenge.id || captcha.answer.trim() !== String(challenge.a + challenge.b)) {
          return { ok: false, reason: 'CAPTCHA_WRONG', challenge: publicChallenge(newChallenge()) };
        }
      }
      const c = findCase(cases, code, phone);
      if (!c) {
        failed++;
        return { ok: false, reason: 'NOT_FOUND', challenge: failed >= MAX_FAILED_LOOKUPS ? publicChallenge(newChallenge()) : undefined };
      }
      failed = 0;
      challenge = null;
      const session = `sess-${++seq}`;
      sessions.set(session, c.phone);
      return { ok: true, session, view: view(c) };
    },
    async openCase(session, code) { return view(ownCase(session, code)); },
    async requestQuoteOtp(session, code) {
      const c = ownCase(session, code);
      if (c.status !== 'QUOTED' || c.quote?.status !== 'SENT') throw new ApiError('INVALID_STATE', 'Phiếu không có báo giá chờ xác nhận.');
      return { sent: true, demoOtp: DEMO_OTP };
    },
    async respondQuote(session, code, { accept, otp }) {
      const c = ownCase(session, code);
      if (accept && otp !== DEMO_OTP) throw new ApiError('INVALID_OTP', 'Mã OTP chưa đúng.');
      const next = respondToQuote(c, accept, now);
      if (next === c) throw new ApiError('INVALID_STATE', 'Phiếu không có báo giá chờ xác nhận.');
      replace(c.code, () => next);
      return view(next);
    },

    /* ---- SLA ---- */
    async listSla() { return cases.filter((c) => c.sla.length > 0).map(row); },
    async pauseSla(code, kind?: PauseKind) {
      const c = getCase(code);
      const s = c.sla.at(-1);
      if (!s) throw new ApiError('INVALID_STATE', 'Phiếu chưa có SLA.');
      if (kind && !PAUSE_OPTIONS[s.code].includes(kind)) throw new ApiError('VALIDATION', 'Lý do tạm dừng không hợp lệ cho mốc SLA này.');
      replace(code, (x) => pauseLatest(x, kind, now));
      return row(getCase(code));
    },
    async resumeSla(code) { replace(getCase(code).code, (x) => resumeLatest(x, now)); return row(getCase(code)); },
    async finishSla(code) { replace(getCase(code).code, (x) => finishLatest(x, now)); return row(getCase(code)); },
    async getSlaHistory(code) { return buildSlaHistory(getCase(code), now, settings.calendar, settings.warnRatio); },
    async getSettings() { return settings; },
    async updateSettings(patch: SlaSettingsPatch) {
      const policy = { ...settings.policy };
      for (const [k, h] of Object.entries(patch.policyHours ?? {}) as Array<[SlaCode, number]>) {
        if (!(h > 0) || !Number.isFinite(h)) throw new ApiError('VALIDATION', 'Số giờ SLA phải lớn hơn 0.');
        policy[k] = { ...policy[k], hours: h };
      }
      const warnRatio = patch.warnRatio ?? settings.warnRatio;
      if (!(warnRatio > 0 && warnRatio < 1)) throw new ApiError('VALIDATION', 'Ngưỡng cảnh báo phải nằm giữa 0% và 100%.');
      const calendar = { ...settings.calendar, ...patch.calendar };
      validateCalendar(calendar);
      settings = { policy, warnRatio, calendar };
      return settings;
    },
    async calculateDeadline(start, hours) {
      if (!Number.isFinite(start) || !(hours > 0)) throw new ApiError('VALIDATION', 'Thời điểm bắt đầu hoặc số giờ không hợp lệ.');
      return addWorkingMinutes(start, hours * 60, settings.calendar);
    },

    /* ---- Cảnh báo ---- */
    async listAlerts() { return alertViews(); },
    async actOnAlert(id, command: AlertCommand) {
      const a = alertViews().find((x) => x.id === id);
      if (!a) throw new ApiError('NOT_FOUND', 'Không tìm thấy cảnh báo.');
      if (!a.commands.includes(command)) throw new ApiError('INVALID_STATE', 'Thao tác này không áp dụng cho cảnh báo ở trạng thái hiện tại.');
      actions[id] = commandToAction(command, now);
      return alertViews().find((x) => x.id === id) as AlertView;
    },

    /* ---- Dashboard, báo giá ---- */
    async getDashboard(): Promise<DashboardView> {
      const list = empty ? [] : cases;
      const atRisk: DashboardView['atRisk'] = [];
      for (const c of list) {
        const s = c.sla.at(-1);
        if (!s || FINAL_STATUSES.includes(c.status)) continue;
        const r = evaluateSla(s, now, settings.calendar, settings.warnRatio);
        if (r.state === 'WARN' || r.state === 'BREACH') atRisk.push({ caseCode: c.code, slaCode: s.code, state: r.state, remainingMinutes: r.remaining });
      }
      return {
        stats: computeStats(list, now, settings.calendar, settings.warnRatio),
        openAlerts: empty ? 0 : alertViews().filter((a) => a.status !== 'HANDLED').length,
        atRisk,
        pendingQuotes: list.filter((c) => c.quote?.status === 'PENDING_MANAGER').map((c) => ({ caseCode: c.code, device: c.device, total: quoteTotal(c.quote!) })),
      };
    },
    async approveQuote(code) {
      const c = getCase(code);
      if (c.quote?.status !== 'PENDING_MANAGER') throw new ApiError('INVALID_STATE', 'Báo giá không ở trạng thái chờ quản lý duyệt.');
      replace(code, (x) => approveQuote(x, now));
    },

    dev: {
      getNow: () => now,
      setNow: (t) => { now = t; },
      setEmpty: (flag) => { empty = flag; },
    },
  };
}
