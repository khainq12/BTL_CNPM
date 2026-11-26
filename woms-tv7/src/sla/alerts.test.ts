import { describe, expect, it } from 'vitest';
import { DEFAULT_CALENDAR } from '../constants';
import { DEMO_NOW, SEED_CASES } from '../data/seed';
import type { WarrantyCase } from '../types';
import { applyAlertActions, commandToAction, deriveAlerts } from './alerts';

const D = (m: number, d: number, h = 0, mi = 0) => new Date(2026, m - 1, d, h, mi).getTime();
const cal = DEFAULT_CALENDAR;
const get = (id: string) => deriveAlerts(SEED_CASES, DEMO_NOW, cal).find((a) => a.id === id);

describe('Nhật ký cảnh báo (BR-25, FR-14)', () => {
  it('phiếu quá hạn có cả cảnh báo sắp quá hạn và quá hạn, gửi điều phối viên và quản lý', () => {
    const w = get('CAS-20261109-0005:SLA-03:SLA_WARN');
    const b = get('CAS-20261109-0005:SLA-03:SLA_BREACH');
    expect(w?.status).toBe('OPEN');
    expect(b?.status).toBe('OPEN');
    expect(b?.recipients).toEqual(['COORDINATOR', 'MANAGER']);
  });
  it('mốc cảnh báo nằm trước mốc vi phạm', () => {
    const w = get('CAS-20261109-0005:SLA-03:SLA_WARN')!;
    const b = get('CAS-20261109-0005:SLA-03:SLA_BREACH')!;
    expect(w.raisedAt < b.raisedAt).toBe(true);
  });
  it('SLA đã hoàn tất trễ: cảnh báo cũ tự đóng, không còn mở', () => {
    const b = get('CAS-20261016-0009:SLA-03:SLA_BREACH');
    expect(b?.status).toBe('HANDLED');
    expect(b?.result).toContain('trễ hạn');
  });
  it('không sinh cảnh báo trùng cho cùng dữ liệu', () => {
    const ids = deriveAlerts(SEED_CASES, DEMO_NOW, cal).map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('phiếu đang tạm dừng trong trần không có cảnh báo chờ linh kiện', () => {
    expect(deriveAlerts(SEED_CASES, DEMO_NOW, cal).some((a) => a.kind === 'PARTS_WAIT_LIMIT')).toBe(false);
  });
  it('chờ linh kiện quá 3 ngày làm việc: cảnh báo điều phối viên và quản lý (PARAM-15)', () => {
    const later = D(11, 16, 14); // thứ Hai, 4 ngày làm việc sau khi bắt đầu chờ lúc 15:00 thứ Ba 10/11
    const a = deriveAlerts(SEED_CASES, later, cal).find((x) => x.kind === 'PARTS_WAIT_LIMIT' && x.caseCode === 'CAS-20261110-0003');
    expect(a?.status).toBe('OPEN');
    expect(a?.recipients).toEqual(['COORDINATOR', 'MANAGER']);
  });
  it('khách không phản hồi báo giá sau 5 ngày làm việc: báo CSKH (PARAM-04)', () => {
    expect(get('CAS-20261111-0006:QUOTE_NO_REPLY')).toBeUndefined();
    const later = D(11, 18, 11); // quá 5 ngày làm việc kể từ 10:30 ngày 11/11 (mỗi ngày 9,5 giờ)
    const a = deriveAlerts(SEED_CASES, later, cal).find((x) => x.id === 'CAS-20261111-0006:QUOTE_NO_REPLY');
    expect(a?.recipients).toEqual(['CSKH']);
    expect(a?.status).toBe('OPEN');
  });
  it('báo giá còn chờ quản lý duyệt thì chưa tính là khách không phản hồi', () => {
    const later = D(12, 31, 11);
    expect(deriveAlerts(SEED_CASES, later, cal).some((x) => x.id === 'CAS-20261111-0010:QUOTE_NO_REPLY')).toBe(false);
  });
});

describe('Xử lý và leo thang cảnh báo', () => {
  const base = deriveAlerts(SEED_CASES, DEMO_NOW, cal).filter((a) => a.id === 'CAS-20261109-0005:SLA-03:SLA_BREACH');
  it('điều phối viên xử lý xong', () => {
    const out = applyAlertActions(base, { [base[0].id]: commandToAction('COORDINATOR_DONE', DEMO_NOW) });
    expect(out[0].status).toBe('HANDLED');
  });
  it('chuyển quản lý rồi quản lý xử lý xong', () => {
    const esc = applyAlertActions(base, { [base[0].id]: commandToAction('ESCALATE', DEMO_NOW) });
    expect(esc[0].status).toBe('ESCALATED');
    const done = applyAlertActions(esc, { [base[0].id]: commandToAction('MANAGER_DONE', DEMO_NOW) });
    expect(done[0].status).toBe('HANDLED');
    expect(done[0].result).toContain('Quản lý');
  });
  it('cảnh báo đã tự đóng không bị mở lại bởi thao tác cũ', () => {
    const closed = deriveAlerts(SEED_CASES, DEMO_NOW, cal).find((a) => a.id === 'CAS-20261016-0009:SLA-03:SLA_BREACH')!;
    const out = applyAlertActions([closed], { [closed.id]: commandToAction('ESCALATE', DEMO_NOW) });
    expect(out[0].status).toBe('HANDLED');
  });
  it('hoàn tất SLA làm cảnh báo tự đóng', () => {
    const cases: WarrantyCase[] = SEED_CASES.map((c) => c.code === 'CAS-20261109-0005'
      ? { ...c, sla: c.sla.map((s, i) => (i === c.sla.length - 1 ? { ...s, end: DEMO_NOW } : s)) } : c);
    const b = deriveAlerts(cases, DEMO_NOW, cal).find((a) => a.id === 'CAS-20261109-0005:SLA-03:SLA_BREACH');
    expect(b?.status).toBe('HANDLED');
  });
});
