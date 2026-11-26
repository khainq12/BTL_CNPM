import { describe, expect, it } from 'vitest';
import { DEFAULT_CALENDAR } from '../constants';
import { DEMO_NOW, SEED_CASES } from '../data/seed';
import { buildNotifications, deviceHistory, findCase, lookupPublic, otherDeviceCases, postRepairWarrantyUntil, publicEta, respondToQuote, setStatus } from './portalService';

const byCode = (code: string) => SEED_CASES.find((c) => c.code === code)!;

describe('Customer Portal (TV7-01…06)', () => {
  it('tra cứu hợp lệ trả đúng thông tin công khai, bỏ cách trong số điện thoại', () => {
    const v = lookupPublic(SEED_CASES, ' cas-20261109-0001 ', '0912 345 678');
    expect(v?.device).toBe('Laptop Dell Inspiron 15');
    expect(v).not.toHaveProperty('phone');
    expect(v).not.toHaveProperty('sla');
  });
  it('mã không tồn tại: null', () => expect(lookupPublic(SEED_CASES, 'CAS-00000000-9999', '0912345678')).toBeNull());
  it('xem phiếu của người khác: cùng kết quả null, không lộ phiếu có tồn tại', () => {
    expect(findCase(SEED_CASES, 'CAS-20261110-0003', '0912345678')).toBeUndefined();
  });
  it('chỉ có số điện thoại đúng mà thiếu mã: không tìm thấy', () => {
    expect(findCase(SEED_CASES, '', '0912345678')).toBeUndefined();
  });
  it('chuyển sang sửa chữa: timeline có mốc mới', () => {
    const next = setStatus(byCode('CAS-20261110-0008'), 'IN_REPAIR', DEMO_NOW);
    expect(next.events.at(-1)?.step).toBe(2);
  });
  it('trạng thái cùng bước hiển thị không tạo mốc trùng', () => {
    const c = byCode('CAS-20261110-0008');
    expect(setStatus(c, 'ASSIGNED', DEMO_NOW).events).toHaveLength(c.events.length);
  });
  it('khách đồng ý báo giá: tiếp tục SLA và chuyển DIAGNOSING', () => {
    const next = respondToQuote(byCode('CAS-20261111-0006'), true, DEMO_NOW);
    expect(next.status).toBe('DIAGNOSING');
    expect(next.sla.at(-1)?.pauses.every((p) => p.to !== null)).toBe(true);
    expect(next.sla.at(-1)?.end).toBeNull();
  });
  it('khách từ chối báo giá: đóng phiếu và đóng SLA', () => {
    const next = respondToQuote(byCode('CAS-20261111-0006'), false, DEMO_NOW);
    expect(next.status).toBe('CANCELLED_RETURN');
    expect(next.sla.at(-1)?.end).toBe(DEMO_NOW);
  });
  it('phiếu không ở trạng thái chờ báo giá thì không đổi', () => {
    const c = byCode('CAS-20261109-0001');
    expect(respondToQuote(c, true, DEMO_NOW)).toBe(c);
  });
  it('thông báo chỉ gồm phiếu của số điện thoại đó', () => {
    const n = buildNotifications(SEED_CASES, '0987654321', DEMO_NOW, DEFAULT_CALENDAR, 10);
    expect(n.every((x) => x.text.includes('CAS-20261110-0003'))).toBe(true);
  });
  it('ETA cho khách không lộ trạng thái nội bộ khi đang tạm dừng', () => {
    const e = publicEta(byCode('CAS-20261110-0003'), DEMO_NOW, DEFAULT_CALENDAR, 0.75);
    expect(e.deadline).toBeNull();
    expect(e.message).toContain('tạm dừng');
  });
  it('thông báo có báo giá đang chờ khách xác nhận', () => {
    const n = buildNotifications(SEED_CASES, '0944556677', DEMO_NOW, DEFAULT_CALENDAR, 10);
    expect(n.some((x) => x.text.includes('báo giá đang chờ bạn xác nhận'))).toBe(true);
  });
});

describe('Lịch sử theo thiết bị (FR-17, BR-29, StRS-04)', () => {
  const current = byCode('CAS-20261109-0001');
  it('chỉ gồm các lần của đúng thiết bị (cùng serial), mới nhất trước', () => {
    const h = deviceHistory(SEED_CASES, current);
    expect(h.map((x) => x.code)).toEqual(['CAS-20261109-0001', 'CAS-20261016-0009']);
  });
  it('phiếu hoàn thành hiện linh kiện đã thay và hạn bảo hành sau sửa chữa 6 tháng kể từ ngày bàn giao', () => {
    const old = deviceHistory(SEED_CASES, current).find((x) => x.code === 'CAS-20261016-0009')!;
    expect(old.parts).toEqual([{ name: 'Quạt tản nhiệt CPU', qty: 1 }]);
    expect(old.warrantyUntil).toBe(new Date(2027, 3, 20, 9, 0).getTime()); // bàn giao 09:00 ngày 20/10/2026
  });
  it('phiếu chưa hoàn thành không có bảo hành sau sửa chữa', () => {
    expect(postRepairWarrantyUntil(current)).toBeNull();
  });
  it('không lộ phiếu của người khác dù cùng serial', () => {
    const other = { ...byCode('CAS-20261016-0009'), code: 'CAS-20261001-0099', phone: '0900000000' };
    const h = deviceHistory([...SEED_CASES, other], current);
    expect(h.some((x) => x.code === 'CAS-20261001-0099')).toBe(false);
  });
  it('thiết bị khác của cùng số điện thoại nằm ở danh sách riêng', () => {
    expect(otherDeviceCases(SEED_CASES, current).map((x) => x.code)).toEqual(['CAS-20261109-0002']);
  });
});
