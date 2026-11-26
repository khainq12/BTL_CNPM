/**
 * Hợp đồng API của phần TV7. Giao diện chỉ gọi các hàm trong WomsApi, không gọi thẳng logic.
 * Hiện thực: mockApi.ts (dữ liệu giả, chạy trong trình duyệt) và httpApi.ts (gọi backend thật).
 * Quy ước:
 *  - Thời gian là epoch mili-giây UTC. Có thể đổi sang ISO-8601 nếu TV4 muốn, chỉ cần đổi httpApi.ts.
 *  - SLA do server tính. Giao diện chỉ hiển thị kết quả.
 *  - Dữ liệu cho khách do server lọc, trình duyệt không nhận SĐT, SLA nội bộ hay ghi chú nội bộ.
 */
import type { Notification, PublicEta } from '../services/portalService';
import type { AlertCommand } from '../sla/alerts';
import type { DashboardStats, HistoryRow } from '../sla/engine';
import type { CaseStatus, HistoryEntry, PauseKind, PolicyMap, PublicCase, SlaAlert, SlaCode, SlaState, WorkCalendar } from '../types';

export type ApiErrorCode =
  | 'NOT_FOUND' | 'FORBIDDEN' | 'INVALID_STATE' | 'INVALID_OTP' | 'VALIDATION'
  | 'CAPTCHA_REQUIRED' | 'CAPTCHA_WRONG' | 'INTERNAL';

export interface CaptchaChallenge { id: string; prompt: string }

export class ApiError extends Error {
  constructor(public code: ApiErrorCode, message: string, public challenge?: CaptchaChallenge) {
    super(message);
    this.name = 'ApiError';
  }
}

/* ---------- Portal khách hàng (công khai) ---------- */
export interface OtherDevice { code: string; device: string; receivedAt: number; status: CaseStatus }

export interface PortalCaseView {
  case: PublicCase;
  eta: PublicEta;
  history: HistoryEntry[];
  otherDevices: OtherDevice[];
  notifications: Notification[];
}

export type LookupResult =
  | { ok: true; session: string; view: PortalCaseView }
  | { ok: false; reason: 'NOT_FOUND' | 'CAPTCHA_REQUIRED' | 'CAPTCHA_WRONG'; challenge?: CaptchaChallenge };

export interface PortalApi {
  /** Sai mã và sai số điện thoại cho cùng kết quả NOT_FOUND. Sai quá 5 lần thì yêu cầu CAPTCHA. Đếm lần sai ở server. */
  lookup(req: { code: string; phone: string; captcha?: { id: string; answer: string } }): Promise<LookupResult>;
  openCase(session: string, code: string): Promise<PortalCaseView>;
  /** Gửi OTP xác nhận báo giá. Chỉ khi báo giá đã gửi cho khách. */
  requestQuoteOtp(session: string, code: string): Promise<{ sent: true; demoOtp?: string }>;
  /** Đồng ý cần OTP, từ chối không cần. */
  respondQuote(session: string, code: string, body: { accept: boolean; otp?: string }): Promise<PortalCaseView>;
}

/* ---------- SLA, cảnh báo, Dashboard (nội bộ, cần đăng nhập) ---------- */
export interface SlaRow {
  caseCode: string;
  caseStatus: CaseStatus;
  slaCode: SlaCode;
  start: number;
  deadline: number | null;
  remainingMinutes: number;
  ratio: number;
  state: SlaState;
  /** Đang tạm dừng nhưng đã quá trần, đồng hồ đã chạy lại. */
  pauseExpired: boolean;
  ended: boolean;
  /** Có một lần tạm dừng đang mở (hiện nút Tiếp tục). */
  paused: boolean;
  pauseOptions: PauseKind[];
}

export interface SlaSettings { policy: PolicyMap; warnRatio: number; calendar: WorkCalendar }
export interface SlaSettingsPatch {
  policyHours?: Partial<Record<SlaCode, number>>;
  warnRatio?: number;
  calendar?: Partial<WorkCalendar>;
}

export interface AlertView extends SlaAlert { commands: AlertCommand[] }

export interface DashboardView {
  stats: DashboardStats;
  openAlerts: number;
  atRisk: Array<{ caseCode: string; slaCode: SlaCode; state: 'WARN' | 'BREACH'; remainingMinutes: number }>;
  pendingQuotes: Array<{ caseCode: string; device: string; total: number }>;
}

export interface InternalApi {
  listSla(): Promise<SlaRow[]>;
  /** Thông thường do chuyển trạng thái phiếu kích hoạt. Ba hàm này để điều chỉnh thủ công và demo. */
  pauseSla(caseCode: string, kind?: PauseKind): Promise<SlaRow>;
  resumeSla(caseCode: string): Promise<SlaRow>;
  finishSla(caseCode: string): Promise<SlaRow>;
  getSlaHistory(caseCode: string): Promise<HistoryRow[]>;
  getSettings(): Promise<SlaSettings>;
  updateSettings(patch: SlaSettingsPatch): Promise<SlaSettings>;
  calculateDeadline(start: number, hours: number): Promise<number | null>;
  listAlerts(): Promise<AlertView[]>;
  actOnAlert(id: string, command: AlertCommand): Promise<AlertView>;
  getDashboard(): Promise<DashboardView>;
  /** Quản lý duyệt báo giá vượt ngưỡng, báo giá được gửi cho khách. */
  approveQuote(caseCode: string): Promise<void>;
}

/** Công cụ chỉ có ở bản mock, để demo. Bản HTTP không có. */
export interface DevTools {
  getNow(): number;
  setNow(t: number): void;
  setEmpty(flag: boolean): void;
}

export interface WomsApi extends PortalApi, InternalApi { dev?: DevTools }
