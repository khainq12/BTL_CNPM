export type SlaCode = 'SLA-01' | 'SLA-02' | 'SLA-03' | 'SLA-04';
export type SlaState = 'OK' | 'WARN' | 'BREACH' | 'PAUSED' | 'DONE' | 'LATE';

/** Trạng thái nội bộ của Case, theo bảng State Transition (SRS mục B.5). */
export type CaseStatus =
  | 'RECEIVED' | 'VERIFYING' | 'QUOTED' | 'DIAGNOSING' | 'WO_CREATED'
  | 'WAITING_PARTS' | 'READY_TO_REPAIR' | 'ASSIGNED' | 'IN_REPAIR' | 'REWORK'
  | 'TESTING' | 'READY_FOR_DELIVERY' | 'COMPLETED' | 'CANCELLED_RETURN';

/** Lịch làm việc. Thời gian tính bằng phút trong ngày; days theo Date.getDay() (0 = Chủ nhật). */
export interface WorkCalendar {
  startMin: number;
  endMin: number;
  days: number[];
  lunch: [number, number] | null;
  holidays: string[]; // 'YYYY-MM-DD'
}

/** Lý do tạm dừng. Mỗi loại có thể có trần thời gian riêng (BR-26, PARAM-16, PARAM-17). */
export type PauseKind = 'DOCS' | 'QUOTE_WAIT' | 'QUOTE_RECONFIRM' | 'WAITING_PARTS' | 'CUSTOMER_DELAY';

export interface Pause { from: number; to: number | null; kind: PauseKind; reason: string }

export interface SlaInstance {
  code: SlaCode;
  targetHours: number;
  start: number;
  end: number | null;
  pauses: Pause[];
}

export interface CaseEvent { step: number; at: number }

/** Báo giá có phí. Trên ngưỡng PARAM-03 phải được quản lý duyệt trước khi gửi khách (BR-07). */
export type QuoteStatus = 'PENDING_MANAGER' | 'SENT' | 'ACCEPTED' | 'REJECTED';
export interface Quote { parts: number; labor: number; status: QuoteStatus; sentAt: number | null }
export interface PublicQuote { parts: number; labor: number; total: number }

export interface ReplacedPart { name: string; qty: number }

export interface WarrantyCase {
  code: string;
  phone: string;
  serial: string;
  device: string;
  symptom: string;
  status: CaseStatus;
  receivedAt: number;
  events: CaseEvent[];
  sla: SlaInstance[];
  quote: Quote | null;
  parts: ReplacedPart[];
}

/** Chỉ gồm thông tin khách hàng được phép xem. Không có SĐT, SLA, ghi chú nội bộ. */
export interface PublicCase {
  code: string;
  serial: string;
  device: string;
  symptom: string;
  receivedAt: number;
  step: number;
  note: string;
  /** Phiếu đã bàn giao hoặc đã đóng: thanh tiến độ hiện hoàn tất. */
  closed: boolean;
  events: CaseEvent[];
  quote: PublicQuote | null;
}

export interface HistoryEntry {
  code: string;
  receivedAt: number;
  status: CaseStatus;
  parts: ReplacedPart[];
  warrantyUntil: number | null; // bảo hành sau sửa chữa (PARAM-01)
}

export interface SlaPolicy { name: string; hours: number }
export type PolicyMap = Record<SlaCode, SlaPolicy>;

/** Nhật ký cảnh báo (BR-25, FR-14 → SLAAlertLog). */
export type Role = 'COORDINATOR' | 'MANAGER' | 'CSKH';
export type AlertKind = 'SLA_WARN' | 'SLA_BREACH' | 'PARTS_WAIT_LIMIT' | 'QUOTE_NO_REPLY';
export type AlertStatus = 'OPEN' | 'HANDLED' | 'ESCALATED';
export interface SlaAlert {
  id: string;
  caseCode: string;
  slaCode: SlaCode | null;
  kind: AlertKind;
  raisedAt: number;
  recipients: Role[];
  status: AlertStatus;
  result: string;
}
