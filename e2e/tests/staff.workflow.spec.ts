import { expect, test } from '@playwright/test'
import { Api } from '../support/api'
import { CasePage, IntakePage, SignInPage } from '../support/pages'

// Kịch bản nghiệp vụ trên giao diện nội bộ, nối backend thật.

let api: Api
test.beforeAll(async () => {
  api = await Api.create()
})
test.afterAll(async () => {
  await api.dispose()
})

test('TC-001 TC-006 | tiếp nhận tạo phiếu tại quầy (có ảnh hiện trạng) và mở được phiếu vừa tạo @smoke', async ({ page }) => {
  await new SignInPage(page).loginOk('tiepnhan')
  const intake = new IntakePage(page)
  await intake.open()
  const serial = `UI${Date.now().toString(36).toUpperCase()}`
  await intake.fill({
    phone: `097${Date.now().toString().slice(-7)}`,
    name: 'Khách Giao Diện',
    brand: 'Dell',
    model: 'Inspiron 15',
    serial,
    symptom: 'Không nhận sạc',
    condition: 'Trầy nhẹ nắp máy',
  })
  await intake.submit()
  const title = page.getByRole('heading', { name: /^Đã tạo phiếu CAS-\d{8}-\d{4}$/ })
  await expect(title).toBeVisible()
  const code = (await title.textContent())!.replace('Đã tạo phiếu ', '')
  await page.getByRole('link', { name: 'Mở phiếu' }).click()
  await expect(page.getByText(code).first()).toBeVisible()
  await expect(page.getByText('Đã tiếp nhận').first()).toBeVisible()
})

test('TC-002 | thiếu thông tin bắt buộc thì không tạo phiếu và chỉ rõ ô thiếu', async ({ page }) => {
  await new SignInPage(page).loginOk('tiepnhan')
  const intake = new IntakePage(page)
  await intake.open()
  await intake.submit()
  await expect(page.getByText(/Phiếu còn thiếu \d+ thông tin bắt buộc/)).toBeVisible()
  await expect(page).toHaveURL(/tiep-nhan\/moi/)
})

test('CSKH ghi kết quả kiểm tra sơ bộ trên giao diện → phiếu chuyển "Kiểm tra sơ bộ"', async ({ page }) => {
  const c = await api.caseAt('RECEIVED')
  await new SignInPage(page).loginOk('cskh')
  const cp = new CasePage(page)
  await cp.open(c.id)
  await cp.action('Kiểm tra sơ bộ').click()
  await expect(cp.dialog()).toContainText('Kiểm tra bảo hành sơ bộ')
  await cp.dialog().getByLabel('Kết quả đối chiếu').selectOption('CON_HAN')
  await cp.dialog().getByLabel('Ghi chú').fill('Tem bảo hành còn nguyên')
  await cp.dialog().getByRole('button', { name: 'Lưu kết quả' }).click()
  await expect(cp.dialog()).toBeHidden()
  const d = await api.detail(c.id)
  expect(d.case.status).toBe('PRECHECK')
})

test('TC-029 | QC đánh dấu đạt đủ mục bắt buộc → chờ bàn giao', async ({ page }) => {
  const c = await api.caseAt('TESTING')
  await new SignInPage(page).loginOk('qc')
  const cp = new CasePage(page)
  await cp.open(c.id)
  await cp.action('Kiểm tra chất lượng').click()
  const boxes = cp.dialog().getByRole('checkbox')
  for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).check()
  await cp.dialog().getByRole('button', { name: 'Xác nhận đạt' }).click()
  await expect(cp.dialog()).toBeHidden()
  expect((await api.detail(c.id)).case.status).toBe('READY_FOR_DELIVERY')
})

test('TC-033 TC-034 | bàn giao: thiếu xác nhận người nhận thì không cho; đủ thì hoàn tất', async ({ page }) => {
  const c = await api.caseAt('READY_FOR_DELIVERY')
  await new SignInPage(page).loginOk('tiepnhan')
  const cp = new CasePage(page)
  await cp.open(c.id)
  await cp.action('Bàn giao thiết bị').click()
  const dlg = cp.dialog()
  await dlg.getByLabel('Họ tên người nhận').fill('Khách E2E')
  await dlg.getByLabel('Xác thực người nhận').fill('Đối chiếu biên nhận gốc')
  await dlg.getByRole('button', { name: 'Xác nhận bàn giao' }).click()
  expect((await api.detail(c.id)).case.status).toBe('READY_FOR_DELIVERY')
  await dlg.getByText('Đã trả đủ phụ kiện').click()
  await dlg.getByText('Khách đã kiểm tra thiết bị cùng nhân viên').click()
  await dlg.getByText('Người nhận đã ký biên bản bàn giao').click()
  await dlg.getByRole('button', { name: 'Xác nhận bàn giao' }).click()
  await expect(dlg).toBeHidden()
  await expect.poll(async () => (await api.detail(c.id)).case.status).toBe('COMPLETED')
})

test('TC-049 | hai người cùng mở một phiếu: người thao tác sau nhận cảnh báo dữ liệu đã thay đổi (EX-14)', async ({ browser }) => {
  const c = await api.caseAt('RECEIVED')
  const a = await browser.newPage()
  const b = await browser.newPage()
  await new SignInPage(a).loginOk('cskh')
  await new SignInPage(b).loginOk('tiepnhan')
  await new CasePage(a).open(c.id)
  await new CasePage(b).open(c.id)
  await expect(b.getByRole('button', { name: 'Đề nghị hủy phiếu' })).toBeVisible()
  // Người A ghi kiểm tra sơ bộ trước (qua API để chắc chắn diễn ra trước khi B bấm).
  await api.call('cskh', 'put', `/cases/${c.id}/precheck`, { version: c.version, warranty: 'CON_HAN', note: 'A' })
  await b.getByRole('button', { name: 'Đề nghị hủy phiếu' }).click()
  await b.getByRole('dialog').getByRole('textbox').first().fill('Khách đổi ý')
  await b
    .getByRole('dialog')
    .getByRole('button', { name: /Gửi|Đề nghị/ })
    .last()
    .click()
  await expect(b.getByText(/Dữ liệu đã thay đổi|vừa được người khác cập nhật|không thực hiện được/).first()).toBeVisible()
  await a.close()
  await b.close()
})

test('TC-057 | quản lý xem bảng điều hành với chỉ số SLA, tỷ lệ sửa lại, tải kỹ thuật viên', async ({ page }) => {
  await new SignInPage(page).loginOk('quanly')
  await page.getByRole('link', { name: /^Bảng điều hành/ }).click()
  await expect(page.getByRole('heading', { name: 'Bảng điều hành' })).toBeVisible()
  for (const k of ['Phiếu đang xử lý', 'Quá hạn', 'Tỷ lệ sửa lại', 'Tỷ lệ đúng hạn']) await expect(page.getByText(k, { exact: true })).toBeVisible()
  await expect(page.getByText('Nguyễn Văn An')).toBeVisible()
})
