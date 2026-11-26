import { describe, expect, it } from 'vitest';
import { createMockApi } from './mockApi';
import { ApiError, type WomsApi } from './contract';

const HOUR = 3_600_000;
const fresh = (): WomsApi => createMockApi();
const errCode = async (p: Promise<unknown>) => {
  try { await p; return 'NO_ERROR'; } catch (e) { return e instanceof ApiError ? e.code : 'OTHER'; }
};
const login = async (api: WomsApi, code: string, phone: string) => {
  const r = await api.lookup({ code, phone });
  if (!r.ok) throw new Error('lookup failed: ' + r.reason);
  return r;
};
const solve = (prompt: string) => { const m = prompt.match(/(\d+) \+ (\d+)/)!; return String(Number(m[1]) + Number(m[2])); };

describe('API Portal: tra cứu và bảo mật', () => {
  it('tra cứu hợp lệ trả đúng dữ liệu công khai', async () => {
    const r = await login(fresh(), 'cas-20261109-0001', '0912 345 678');
    expect(r.view.case.device).toBe('Laptop Dell Inspiron 15');
    expect(r.view.case.serial).toBe('DL-I15-7K2M91');
  });
  it('dữ liệu trả về cho khách không chứa số điện thoại hay SLA nội bộ', async () => {
    const r = await login(fresh(), 'CAS-20261109-0001', '0912345678');
    const json = JSON.stringify(r.view);
    expect(json).not.toContain('0912345678');
    expect(json).not.toContain('"sla"');
    expect(json).not.toContain('"phone"');
  });
  it('sai mã và sai số điện thoại cho cùng một kết quả', async () => {
    const api = fresh();
    const wrongPhone = await api.lookup({ code: 'CAS-20261110-0003', phone: '0912345678' });
    const wrongCode = await api.lookup({ code: 'CAS-00000000-9999', phone: '0912345678' });
    expect(wrongPhone).toEqual(wrongCode);
  });
  it('sai 5 lần thì yêu cầu CAPTCHA, đúng đáp án và đúng thông tin mới vào được', async () => {
    const api = fresh();
    let last = await api.lookup({ code: 'x', phone: 'y' });
    for (let i = 0; i < 4; i++) last = await api.lookup({ code: 'x', phone: 'y' });
    expect(last.ok).toBe(false);
    if (last.ok) return;
    expect(last.challenge === undefined).toBe(false);
    const blocked = await api.lookup({ code: 'CAS-20261109-0001', phone: '0912345678' });
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.reason).toBe('CAPTCHA_REQUIRED');
    const wrong = await api.lookup({ code: 'CAS-20261109-0001', phone: '0912345678', captcha: { id: blocked.challenge!.id, answer: '0' } });
    expect(wrong.ok === false && wrong.reason).toBe('CAPTCHA_WRONG');
    const ch = (wrong as { ok: false; challenge?: { id: string; prompt: string } }).challenge!;
    const ok = await api.lookup({ code: 'CAS-20261109-0001', phone: '0912345678', captcha: { id: ch.id, answer: solve(ch.prompt) } });
    expect(ok.ok).toBe(true);
  });
  it('phiên của số này không mở được phiếu của số khác', async () => {
    const api = fresh();
    const r = await login(api, 'CAS-20261109-0001', '0912345678');
    expect(await errCode(api.openCase(r.session, 'CAS-20261110-0003'))).toBe('NOT_FOUND');
    expect(await errCode(api.openCase('sess-khong-co', 'CAS-20261109-0001'))).toBe('FORBIDDEN');
  });
  it('mở được thiết bị khác của cùng số điện thoại', async () => {
    const api = fresh();
    const r = await login(api, 'CAS-20261109-0001', '0912345678');
    const other = r.view.otherDevices[0];
    expect((await api.openCase(r.session, other.code)).case.code).toBe(other.code);
  });
});

describe('API Portal: báo giá', () => {
  it('đồng ý với OTP sai bị từ chối, OTP đúng thì phiếu chuyển sang chẩn đoán', async () => {
    const api = fresh();
    const r = await login(api, 'CAS-20261111-0006', '0944556677');
    expect(r.view.case.quote?.total).toBe(1_250_000);
    const otp = await api.requestQuoteOtp(r.session, 'CAS-20261111-0006');
    expect(await errCode(api.respondQuote(r.session, 'CAS-20261111-0006', { accept: true, otp: '111111' }))).toBe('INVALID_OTP');
    const v = await api.respondQuote(r.session, 'CAS-20261111-0006', { accept: true, otp: otp.demoOtp });
    expect(v.case.quote).toBeNull();
    expect(v.case.note).toContain('chẩn đoán');
  });
  it('từ chối không cần OTP và đóng phiếu', async () => {
    const api = fresh();
    const r = await login(api, 'CAS-20261111-0006', '0944556677');
    const v = await api.respondQuote(r.session, 'CAS-20261111-0006', { accept: false });
    expect(v.case.closed).toBe(true);
  });
  it('báo giá chờ quản lý duyệt: khách không thấy tiền và không xác nhận được', async () => {
    const api = fresh();
    const r = await login(api, 'CAS-20261111-0010', '0977889900');
    expect(r.view.case.quote).toBeNull();
    expect(await errCode(api.requestQuoteOtp(r.session, 'CAS-20261111-0010'))).toBe('INVALID_STATE');
    expect(await errCode(api.respondQuote(r.session, 'CAS-20261111-0010', { accept: false }))).toBe('INVALID_STATE');
  });
  it('sau khi quản lý duyệt, khách thấy báo giá đủ chi tiết', async () => {
    const api = fresh();
    const r = await login(api, 'CAS-20261111-0010', '0977889900');
    await api.approveQuote('CAS-20261111-0010');
    const v = await api.openCase(r.session, 'CAS-20261111-0010');
    expect(v.case.quote).toEqual({ parts: 2_100_000, labor: 400_000, total: 2_500_000 });
  });
});

describe('API SLA và cảnh báo', () => {
  it('danh sách SLA: phiếu quá hạn và phiếu đang tạm dừng', async () => {
    const rows = await fresh().listSla();
    const byCode = (c: string) => rows.find((r) => r.caseCode === c)!;
    expect(rows).toHaveLength(10);
    expect(byCode('CAS-20261109-0005').state).toBe('BREACH');
    expect(byCode('CAS-20261110-0003').state).toBe('PAUSED');
    expect(byCode('CAS-20261110-0003').paused).toBe(true);
  });
  it('tạm dừng, tiếp tục, hoàn tất', async () => {
    const api = fresh();
    const code = 'CAS-20261109-0001';
    expect((await api.pauseSla(code)).paused).toBe(true);
    expect((await api.resumeSla(code)).paused).toBe(false);
    const done = await api.finishSla(code);
    expect(done.ended).toBe(true);
    expect(done.state === 'DONE' || done.state === 'LATE').toBe(true);
  });
  it('lý do tạm dừng không hợp lệ bị từ chối', async () => {
    expect(await errCode(fresh().pauseSla('CAS-20261109-0001', 'DOCS'))).toBe('VALIDATION');
  });
  it('tua giờ làm phiếu từ sắp quá hạn thành quá hạn', async () => {
    const api = fresh();
    const code = 'CAS-20261111-0007';
    expect((await api.listSla()).find((r) => r.caseCode === code)!.state).toBe('WARN');
    api.dev!.setNow(api.dev!.getNow() + HOUR);
    expect((await api.listSla()).find((r) => r.caseCode === code)!.state).toBe('BREACH');
  });
  it('lịch sử SLA có dòng ghi nhận vi phạm của phiếu quá hạn', async () => {
    const h = await fresh().getSlaHistory('CAS-20261109-0005');
    expect(h.some((x) => x.text.startsWith('Ghi nhận vi phạm'))).toBe(true);
  });
  it('đổi lịch làm việc làm đổi hạn tính ra, và dữ liệu sai bị từ chối', async () => {
    const api = fresh();
    const fri = new Date(2026, 10, 13, 16, 0).getTime();
    expect(await api.calculateDeadline(fri, 2)).toBe(new Date(2026, 10, 14, 8, 30).getTime());
    await api.updateSettings({ calendar: { days: [1, 2, 3, 4, 5] } });
    expect(await api.calculateDeadline(fri, 2)).toBe(new Date(2026, 10, 16, 8, 30).getTime());
    expect(await errCode(api.updateSettings({ calendar: { startMin: 600, endMin: 500 } }))).toBe('VALIDATION');
    expect(await errCode(api.updateSettings({ warnRatio: 1.5 }))).toBe('VALIDATION');
    expect(await errCode(api.updateSettings({ policyHours: { 'SLA-01': 0 } }))).toBe('VALIDATION');
    expect(await errCode(api.calculateDeadline(fri, -1))).toBe('VALIDATION');
  });
  it('cảnh báo: chuyển quản lý rồi quản lý xử lý, thao tác sai bước bị từ chối', async () => {
    const api = fresh();
    const id = 'CAS-20261109-0005:SLA-03:SLA_BREACH';
    const before = (await api.listAlerts()).find((a) => a.id === id)!;
    expect(before.commands).toEqual(['COORDINATOR_DONE', 'ESCALATE']);
    expect((await api.actOnAlert(id, 'ESCALATE')).status).toBe('ESCALATED');
    expect(await errCode(api.actOnAlert(id, 'COORDINATOR_DONE'))).toBe('INVALID_STATE');
    expect((await api.actOnAlert(id, 'MANAGER_DONE')).status).toBe('HANDLED');
    expect(await errCode(api.actOnAlert('khong-co', 'ESCALATE'))).toBe('NOT_FOUND');
  });
});

describe('API Dashboard', () => {
  it('số liệu và danh sách báo giá chờ duyệt', async () => {
    const d = await fresh().getDashboard();
    expect(d.stats.total).toBe(10);
    expect(d.pendingQuotes.map((q) => q.caseCode)).toEqual(['CAS-20261111-0010']);
    expect(d.atRisk.some((x) => x.caseCode === 'CAS-20261109-0005' && x.state === 'BREACH')).toBe(true);
  });
  it('chưa có phiếu nào: mọi số là 0, tỷ lệ là null', async () => {
    const api = fresh();
    api.dev!.setEmpty(true);
    const d = await api.getDashboard();
    expect(d.stats.total).toBe(0);
    expect(d.stats.onTimeRate).toBeNull();
    expect(d.openAlerts).toBe(0);
    expect(d.atRisk).toEqual([]);
  });
  it('duyệt báo giá xong thì hết chờ duyệt, duyệt lần hai bị từ chối', async () => {
    const api = fresh();
    await api.approveQuote('CAS-20261111-0010');
    expect((await api.getDashboard()).pendingQuotes).toEqual([]);
    expect(await errCode(api.approveQuote('CAS-20261111-0010'))).toBe('INVALID_STATE');
    expect(await errCode(api.approveQuote('CAS-khong-co'))).toBe('NOT_FOUND');
  });
});
