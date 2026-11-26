import { DEFAULT_POLICY, PAUSE_LABEL } from '../constants';
import type { CaseStatus, Pause, PauseKind, Quote, ReplacedPart, SlaCode, SlaInstance, WarrantyCase } from '../types';

/** Dữ liệu giả lập (GĐ-03): không dùng dữ liệu cá nhân thật. */
const D = (m: number, d: number, h = 0, mi = 0) => new Date(2026, m - 1, d, h, mi).getTime();
export const DEMO_NOW = D(11, 11, 14, 0);

const pause = (kind: PauseKind, from: number, to: number | null = null): Pause => ({ from, to, kind, reason: PAUSE_LABEL[kind] });
const sla = (code: SlaCode, start: number, end: number | null = null, pauses: Pause[] = []): SlaInstance => ({
  code, targetHours: DEFAULT_POLICY[code].hours, start, end, pauses,
});

const make = (
  code: string, phone: string, serial: string, device: string, symptom: string, status: CaseStatus,
  events: Array<[number, number]>, slas: SlaInstance[],
  extra: { quote?: Quote; parts?: ReplacedPart[] } = {},
): WarrantyCase => ({
  code, phone, serial, device, symptom, status, receivedAt: events[0][1],
  events: events.map(([step, at]) => ({ step, at })), sla: slas, quote: extra.quote ?? null, parts: extra.parts ?? [],
});

export const SEED_CASES: WarrantyCase[] = [
  make('CAS-20261109-0001', '0912345678', 'DL-I15-7K2M91', 'Laptop Dell Inspiron 15', 'Không lên nguồn', 'IN_REPAIR',
    [[0, D(11, 9, 8, 30)], [1, D(11, 9, 9, 15)], [2, D(11, 9, 11, 30)]],
    [sla('SLA-01', D(11, 9, 8, 30), D(11, 9, 9, 15)), sla('SLA-02', D(11, 9, 9, 15), D(11, 9, 11, 30)), sla('SLA-03', D(11, 9, 11, 30))]),
  make('CAS-20261109-0002', '0912345678', 'HP-M404-55A31', 'Máy in HP LaserJet Pro M404', 'Kẹt giấy liên tục', 'COMPLETED',
    [[0, D(11, 9, 9)], [1, D(11, 9, 11)], [2, D(11, 9, 13)], [3, D(11, 10, 9, 30)], [4, D(11, 10, 15)]],
    [sla('SLA-01', D(11, 9, 9), D(11, 9, 9, 40)), sla('SLA-02', D(11, 9, 9, 40), D(11, 9, 11)), sla('SLA-03', D(11, 9, 11), D(11, 10, 11)), sla('SLA-04', D(11, 10, 11), D(11, 10, 15))],
    { parts: [{ name: 'Trục kéo giấy', qty: 2 }] }),
  // Lần sửa trước của chính chiếc Dell ở phiếu 0001: dùng để thử lịch sử theo thiết bị và bảo hành sau sửa chữa.
  make('CAS-20261016-0009', '0912345678', 'DL-I15-7K2M91', 'Laptop Dell Inspiron 15', 'Quạt kêu to, máy nóng', 'COMPLETED',
    [[0, D(10, 16, 8, 30)], [1, D(10, 16, 9)], [2, D(10, 16, 9)], [3, D(10, 19, 16)], [4, D(10, 20, 9)]],
    [sla('SLA-01', D(10, 16, 8, 30), D(10, 16, 9)), sla('SLA-02', D(10, 16, 9), D(10, 16, 9)), sla('SLA-03', D(10, 16, 9), D(10, 19, 16)), sla('SLA-04', D(10, 19, 16), D(10, 20, 9))],
    { parts: [{ name: 'Quạt tản nhiệt CPU', qty: 1 }] }),
  make('CAS-20261110-0003', '0987654321', 'AS-G15-33B70', 'PC Asus ROG Strix G15', 'Treo máy khi chơi game', 'WAITING_PARTS',
    [[0, D(11, 10, 9)], [1, D(11, 10, 11)]],
    [sla('SLA-01', D(11, 10, 9), D(11, 10, 9, 30)), sla('SLA-02', D(11, 10, 9, 30), D(11, 10, 11)),
     sla('SLA-03', D(11, 10, 11), null, [pause('WAITING_PARTS', D(11, 10, 15))])]),
  make('CAS-20261110-0004', '0901112233', 'LN-T14-90C12', 'Laptop Lenovo ThinkPad T14', 'Màn hình bị sọc', 'READY_FOR_DELIVERY',
    [[0, D(11, 10, 8, 30)], [1, D(11, 10, 9)], [2, D(11, 10, 10)], [3, D(11, 11, 9)], [4, D(11, 11, 10)]],
    [sla('SLA-01', D(11, 10, 8, 30), D(11, 10, 9)), sla('SLA-02', D(11, 10, 9), D(11, 10, 10)), sla('SLA-03', D(11, 10, 10), D(11, 11, 10)), sla('SLA-04', D(11, 11, 10))]),
  make('CAS-20261109-0005', '0933445566', 'HP-PV14-18D44', 'Laptop HP Pavilion 14', 'Pin chai phồng', 'IN_REPAIR',
    [[0, D(11, 9, 8)], [1, D(11, 9, 8, 20)], [2, D(11, 9, 8, 30)]],
    [sla('SLA-01', D(11, 9, 8), D(11, 9, 8, 20)), sla('SLA-02', D(11, 9, 8, 20), D(11, 9, 8, 30)), sla('SLA-03', D(11, 9, 8, 30))]),
  make('CAS-20261111-0006', '0944556677', 'AC-A5-72E05', 'Laptop Acer Aspire 5', 'Vỡ màn hình do rơi', 'QUOTED',
    [[0, D(11, 11, 9)], [1, D(11, 11, 10, 30)]],
    [sla('SLA-01', D(11, 11, 9), D(11, 11, 9, 45)), sla('SLA-02', D(11, 11, 9, 45), null, [pause('QUOTE_WAIT', D(11, 11, 10, 30))])],
    { quote: { parts: 950_000, labor: 300_000, status: 'SENT', sentAt: D(11, 11, 10, 30) } }),
  make('CAS-20261111-0007', '0955667788', 'CN-G3010-61F28', 'Máy in Canon PIXMA G3010', 'Không nhận mực', 'RECEIVED',
    [[0, D(11, 11, 12, 30)]], [sla('SLA-01', D(11, 11, 12, 30))]),
  make('CAS-20261110-0008', '0966778899', 'DL-OP7090-44G90', 'PC Dell OptiPlex 7090', 'Tự khởi động lại', 'DIAGNOSING',
    [[0, D(11, 10, 13, 30)], [1, D(11, 10, 14)]],
    [sla('SLA-01', D(11, 10, 13, 30), D(11, 10, 14)), sla('SLA-02', D(11, 10, 14))]),
  // Báo giá 2.500.000 đồng vượt ngưỡng 2.000.000: đang chờ quản lý duyệt, khách chưa nhìn thấy.
  make('CAS-20261111-0010', '0977889900', 'DL-XPS13-20H66', 'Laptop Dell XPS 13', 'Vào nước, không lên nguồn', 'QUOTED',
    [[0, D(11, 11, 12, 45)], [1, D(11, 11, 13)]],
    [sla('SLA-01', D(11, 11, 12, 45), D(11, 11, 13)), sla('SLA-02', D(11, 11, 13))],
    { quote: { parts: 2_100_000, labor: 400_000, status: 'PENDING_MANAGER', sentAt: null } }),
];
