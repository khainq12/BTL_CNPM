import type { CaseStatus, PauseKind, PolicyMap, SlaCode, WorkCalendar } from './types';

/** Mặc định theo SRS NFR-04: 08:00–17:30, Thứ Hai đến Thứ Bảy. Giá trị giả định, chưa xác nhận thực địa. */
export const DEFAULT_CALENDAR: WorkCalendar = {
  startMin: 8 * 60,
  endMin: 17 * 60 + 30,
  days: [1, 2, 3, 4, 5, 6],
  lunch: null,
  holidays: [],
};

/** Bốn mốc SLA theo SRS mục B.6. */
export const DEFAULT_POLICY: PolicyMap = {
  'SLA-01': { name: 'Phản hồi và tiếp nhận', hours: 2 },
  'SLA-02': { name: 'Chẩn đoán và lập Work Order', hours: 4 },
  'SLA-03': { name: 'Sửa chữa hoàn tất', hours: 24 },
  'SLA-04': { name: 'Bàn giao thiết bị', hours: 8 },
};

export const PAUSE_LABEL: Record<PauseKind, string> = {
  DOCS: 'Chờ bổ sung chứng từ',
  QUOTE_WAIT: 'Chờ khách phản hồi báo giá',
  QUOTE_RECONFIRM: 'Chờ khách xác nhận lại báo giá',
  WAITING_PARTS: 'Chờ linh kiện',
  CUSTOMER_DELAY: 'Khách hẹn ngày nhận trễ',
};

/** Các lý do được phép tạm dừng ở từng mốc SLA. Mục đầu tiên là mặc định. */
export const PAUSE_OPTIONS: Record<SlaCode, PauseKind[]> = {
  'SLA-01': ['DOCS'],
  'SLA-02': ['QUOTE_WAIT'],
  'SLA-03': ['WAITING_PARTS', 'QUOTE_RECONFIRM'],
  'SLA-04': ['CUSTOMER_DELAY'],
};

/**
 * Trần tạm dừng theo ngày làm việc (BR-26). Phần chờ vượt trần vẫn tính vào thời gian xử lý.
 * Giá trị theo PARAM-17 (thiếu linh kiện: 3 ngày) và PARAM-16 (xác nhận lại báo giá: 5 ngày).
 * Loại không có trần thì tạm dừng không giới hạn.
 */
export const PAUSE_CAP_DAYS: Partial<Record<PauseKind, number>> = { WAITING_PARTS: 3, QUOTE_RECONFIRM: 5 };

export const QUOTE_APPROVAL_THRESHOLD = 2_000_000; // PARAM-03: trên mức này phải có quản lý duyệt trước khi gửi
export const QUOTE_REMINDER_DAYS = [2, 4];         // PARAM-18: nhắc khách sau 2 và 4 ngày làm việc
export const QUOTE_NO_REPLY_DAYS = 5;              // PARAM-04: sau 5 ngày báo CSKH liên hệ, không tự coi là từ chối
export const POST_REPAIR_WARRANTY_MONTHS = 6;      // PARAM-01

/** Năm bước hiển thị cho khách (file phân công TV7, mục 2.1). */
export const PUBLIC_STEPS = ['Đã tiếp nhận', 'Đã xác minh bảo hành', 'Đang sửa chữa', 'Chờ QC', 'Bàn giao'];

export const PUBLIC_STEP_OF: Record<CaseStatus, number> = {
  RECEIVED: 0, VERIFYING: 0,
  QUOTED: 1, DIAGNOSING: 1, WO_CREATED: 1, WAITING_PARTS: 1, READY_TO_REPAIR: 1, ASSIGNED: 1,
  IN_REPAIR: 2, REWORK: 2, TESTING: 3,
  READY_FOR_DELIVERY: 4, COMPLETED: 4, CANCELLED_RETURN: 4,
};

export const STATUS_NOTE: Partial<Record<CaseStatus, string>> = {
  DIAGNOSING: 'Kỹ thuật viên đang chẩn đoán lỗi.',
  QUOTED: 'Cần bạn xác nhận báo giá để tiếp tục sửa chữa.',
  WAITING_PARTS: 'Thiết bị đang chờ linh kiện thay thế.',
  REWORK: 'Thiết bị đang được xử lý lại sau kiểm tra.',
  READY_FOR_DELIVERY: 'Thiết bị đã sẵn sàng, mời bạn đến nhận.',
  COMPLETED: 'Thiết bị đã được bàn giao.',
  CANCELLED_RETURN: 'Phiếu đã đóng, thiết bị được trả lại chưa sửa.',
};

export const STATUS_LABEL: Record<CaseStatus, string> = {
  RECEIVED: 'Đã tiếp nhận', VERIFYING: 'Đang xác minh', QUOTED: 'Chờ báo giá', DIAGNOSING: 'Chẩn đoán',
  WO_CREATED: 'Đã lập Work Order', WAITING_PARTS: 'Chờ linh kiện', READY_TO_REPAIR: 'Sẵn sàng sửa',
  ASSIGNED: 'Đã phân công', IN_REPAIR: 'Đang sửa', REWORK: 'Sửa lại', TESTING: 'Kiểm định',
  READY_FOR_DELIVERY: 'Chờ bàn giao', COMPLETED: 'Hoàn thành', CANCELLED_RETURN: 'Đã trả máy',
};

export const FINAL_STATUSES: CaseStatus[] = ['COMPLETED', 'CANCELLED_RETURN'];
export const WAITING_CUSTOMER_STATUSES: CaseStatus[] = ['QUOTED', 'READY_FOR_DELIVERY'];
