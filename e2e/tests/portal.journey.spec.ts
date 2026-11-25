import { expect, test } from '@playwright/test'
import { Api } from '../support/api'
import { PortalPage, Sidebar, SignInPage } from '../support/pages'

// Hành trình xuyên hệ thống: khách ↔ cổng khách hàng ↔ API ↔ giao diện nhân viên.

test('khách gửi yêu cầu trực tuyến → nhân viên tiếp nhận thấy trong "Yêu cầu trực tuyến" @smoke', async ({ page, browser }) => {
  await page.goto('/#gui-yeu-cau')
  const serial = `WEB${Date.now().toString(36).toUpperCase()}`
  await page.getByLabel('Họ tên').fill('Khách Trực Tuyến')
  await page.getByLabel('Số điện thoại').fill(`096${Date.now().toString().slice(-7)}`)
  await page.getByLabel('Loại').selectOption('printer')
  await page.getByLabel('Hãng').fill('Brother')
  await page.getByLabel('Model').fill('HL-L2321D')
  await page.getByLabel('Serial (in trên tem)').fill(serial)
  await page.getByLabel('Mô tả lỗi').fill('In ra trang trắng')
  await page.getByRole('button', { name: 'Gửi yêu cầu' }).click()
  const code = (await page.getByTestId('new-code').textContent())!.trim()
  expect(code).toMatch(/^CAS-\d{8}-\d{4}$/)

  const staff = await browser.newPage({ baseURL: 'http://localhost:4173' })
  await new SignInPage(staff).loginOk('tiepnhan')
  await new Sidebar(staff).link('Yêu cầu trực tuyến').click()
  await expect(staff.getByText(code)).toBeVisible()
  await staff.close()
})

test('TC-008 | khách đồng ý báo giá bằng OTP trên cổng → trung tâm tự lập lệnh sửa chữa', async ({ page }) => {
  const api = await Api.create()
  const phone = `093${Date.now().toString().slice(-7)}`
  let c = await api.createCase({ phone })
  c = await api.call('cskh', 'put', `/cases/${c.id}/precheck`, { version: c.version, warranty: 'HET_HAN', note: 'Hết hạn' })
  c = await api.call('dieuphoi', 'put', `/cases/${c.id}/diagnosis-assignment`, { version: c.version, techId: 'u-ktv2' })
  c = await api.call('ktv.binh', 'put', `/cases/${c.id}/diagnosis`, {
    version: c.version,
    cause: 'Hỏng bản lề',
    causeType: 'PHAN_CUNG',
    severity: 'NHE',
    repairable: true,
    plan: 'Thay bản lề',
    tasks: [{ title: 'Thay bản lề', minutes: 40 }],
    parts: [],
    laborEstimate: 250_000,
  })
  c = await api.call('cskh', 'put', `/cases/${c.id}/eligibility`, {
    version: c.version,
    decision: 'CO_PHI',
    ruleCode: 'D3',
    reason: 'Hết hạn bảo hành',
    quote: { items: [{ label: 'Bản lề', qty: 1, unitPrice: 350_000 }], labor: 250_000 },
  })
  expect(c.status).toBe('QUOTED')

  const portal = new PortalPage(page)
  await portal.lookup(c.code, phone)
  await expect(page.getByTestId('quote')).toContainText('600.000')
  await page.getByRole('button', { name: 'Đồng ý sửa' }).click()
  await page.getByLabel(/Mã OTP/).fill('123456')
  await page.getByRole('button', { name: 'Xác nhận đồng ý' }).click()
  await expect(page.getByTestId('quote').getByRole('alert')).toContainText('OTP chưa đúng')
  await page.getByLabel(/Mã OTP/).fill('000000')
  await page.getByRole('button', { name: 'Xác nhận đồng ý' }).click()
  await expect(page.getByTestId('quote')).toHaveCount(0)
  await expect.poll(async () => (await api.detail(c.id)).case.status).toBe('READY_TO_REPAIR')
  await api.dispose()
})
