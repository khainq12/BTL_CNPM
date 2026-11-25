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

export interface Pause { from: number; to: number | null; reason: string }

export interface SlaInstance {
  code: SlaCode;
  targetHours: number;
  start: number;
  end: number | null;
  pauses: Pause[];
}

export interface CaseEvent { step: number; at: number }

export interface WarrantyCase {
  code: string;
  phone: string;
  device: string;
  symptom: string;
  status: CaseStatus;
  receivedAt: number;
  events: CaseEvent[];
  sla: SlaInstance[];
  quote: number;
}

/** Chỉ gồm thông tin khách hàng được phép xem. Không có SĐT, SLA, ghi chú nội bộ. */
export interface PublicCase {
  code: string;
  device: string;
  symptom: string;
  receivedAt: number;
  step: number;
  note: string;
  events: CaseEvent[];
  quote: number;
}

export interface SlaPolicy { name: string; hours: number }
export type PolicyMap = Record<SlaCode, SlaPolicy>;
