import type { CaseStatus, PolicyMap, SlaCode, WorkCalendar } from './types';

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

export const PAUSE_REASON: Record<SlaCode, string> = {
  'SLA-01': 'Chờ bổ sung chứng từ',
  'SLA-02': 'Chờ khách phản hồi báo giá',
  'SLA-03': 'Chờ linh kiện',
  'SLA-04': 'Khách hẹn ngày nhận trễ',
};

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
