import { DEFAULT_POLICY } from '../constants';
import type { CaseStatus, Pause, SlaCode, SlaInstance, WarrantyCase } from '../types';

/** Dữ liệu giả lập (GĐ-03): không dùng dữ liệu cá nhân thật. */
const D = (m: number, d: number, h = 0, mi = 0) => new Date(2026, m - 1, d, h, mi).getTime();
export const DEMO_NOW = D(11, 11, 14, 0);

const sla = (code: SlaCode, start: number, end: number | null = null, pauses: Pause[] = []): SlaInstance => ({
  code, targetHours: DEFAULT_POLICY[code].hours, start, end, pauses,
});

const make = (
  code: string, phone: string, device: string, symptom: string, status: CaseStatus,
  events: Array<[number, number]>, slas: SlaInstance[], quote = 0,
): WarrantyCase => ({
  code, phone, device, symptom, status, receivedAt: events[0][1],
  events: events.map(([step, at]) => ({ step, at })), sla: slas, quote,
});

export const SEED_CASES: WarrantyCase[] = [
  make('CAS-20261109-0001', '0912345678', 'Laptop Dell Inspiron 15', 'Không lên nguồn', 'IN_REPAIR',
    [[0, D(11, 9, 8, 30)], [1, D(11, 9, 9, 15)], [2, D(11, 9, 11, 30)]],
    [sla('SLA-01', D(11, 9, 8, 30), D(11, 9, 9, 15)), sla('SLA-02', D(11, 9, 9, 15), D(11, 9, 11, 30)), sla('SLA-03', D(11, 9, 11, 30))]),
  make('CAS-20261109-0002', '0912345678', 'Máy in HP LaserJet Pro M404', 'Kẹt giấy liên tục', 'COMPLETED',
    [[0, D(11, 9, 9)], [1, D(11, 9, 11)], [2, D(11, 9, 13)], [3, D(11, 10, 9, 30)], [4, D(11, 10, 15)]],
    [sla('SLA-01', D(11, 9, 9), D(11, 9, 9, 40)), sla('SLA-02', D(11, 9, 9, 40), D(11, 9, 11)), sla('SLA-03', D(11, 9, 11), D(11, 10, 11)), sla('SLA-04', D(11, 10, 11), D(11, 10, 15))]),
  make('CAS-20261106-0009', '0912345678', 'Laptop MSI Modern 14', 'Quạt kêu to, máy nóng', 'COMPLETED',
    [[0, D(11, 6, 8, 30)], [1, D(11, 6, 9)], [2, D(11, 6, 9)], [3, D(11, 9, 16)], [4, D(11, 10, 9)]],
    [sla('SLA-01', D(11, 6, 8, 30), D(11, 6, 9)), sla('SLA-02', D(11, 6, 9), D(11, 6, 9)), sla('SLA-03', D(11, 6, 9), D(11, 9, 16)), sla('SLA-04', D(11, 9, 16), D(11, 10, 9))]),
  make('CAS-20261110-0003', '0987654321', 'PC Asus ROG Strix G15', 'Treo máy khi chơi game', 'WAITING_PARTS',
    [[0, D(11, 10, 9)], [1, D(11, 10, 11)]],
    [sla('SLA-01', D(11, 10, 9), D(11, 10, 9, 30)), sla('SLA-02', D(11, 10, 9, 30), D(11, 10, 11)),
     sla('SLA-03', D(11, 10, 11), null, [{ from: D(11, 10, 15), to: null, reason: 'Chờ linh kiện' }])]),
  make('CAS-20261110-0004', '0901112233', 'Laptop Lenovo ThinkPad T14', 'Màn hình bị sọc', 'READY_FOR_DELIVERY',
    [[0, D(11, 10, 8, 30)], [1, D(11, 10, 9)], [2, D(11, 10, 10)], [3, D(11, 11, 9)], [4, D(11, 11, 10)]],
    [sla('SLA-01', D(11, 10, 8, 30), D(11, 10, 9)), sla('SLA-02', D(11, 10, 9), D(11, 10, 10)), sla('SLA-03', D(11, 10, 10), D(11, 11, 10)), sla('SLA-04', D(11, 11, 10))]),
  make('CAS-20261109-0005', '0933445566', 'Laptop HP Pavilion 14', 'Pin chai phồng', 'IN_REPAIR',
    [[0, D(11, 9, 8)], [1, D(11, 9, 8, 20)], [2, D(11, 9, 8, 30)]],
    [sla('SLA-01', D(11, 9, 8), D(11, 9, 8, 20)), sla('SLA-02', D(11, 9, 8, 20), D(11, 9, 8, 30)), sla('SLA-03', D(11, 9, 8, 30))]),
  make('CAS-20261111-0006', '0944556677', 'Laptop Acer Aspire 5', 'Vỡ màn hình do rơi', 'QUOTED',
    [[0, D(11, 11, 9)], [1, D(11, 11, 10, 30)]],
    [sla('SLA-01', D(11, 11, 9), D(11, 11, 9, 45)),
     sla('SLA-02', D(11, 11, 9, 45), null, [{ from: D(11, 11, 10, 30), to: null, reason: 'Chờ khách phản hồi báo giá' }])], 1_250_000),
  make('CAS-20261111-0007', '0955667788', 'Máy in Canon PIXMA G3010', 'Không nhận mực', 'RECEIVED',
    [[0, D(11, 11, 12, 30)]], [sla('SLA-01', D(11, 11, 12, 30))]),
  make('CAS-20261110-0008', '0966778899', 'PC Dell OptiPlex 7090', 'Tự khởi động lại', 'DIAGNOSING',
    [[0, D(11, 10, 13, 30)], [1, D(11, 10, 14)]],
    [sla('SLA-01', D(11, 10, 13, 30), D(11, 10, 14)), sla('SLA-02', D(11, 10, 14))]),
];
