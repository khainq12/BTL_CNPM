import { expect, test } from '@playwright/test'
import { PortalPage } from '../support/pages'

// Cổng khách hàng: tra cứu bằng mã phiếu + SĐT (BR-11), chạy cả trên máy tính và điện thoại.

test('TC-048 | đúng mã phiếu và SĐT thì xem được tiến độ 5 bước @smoke', async ({ page }) => {
  const p = new PortalPage(page)
  await p.lookup('CAS-20261106-0041', '0912345678')
  await expect(page.getByTestId('case-code')).toHaveText('CAS-20261106-0041')
  await expect(page.getByTestId('current-step')).toContainText('Đang sửa chữa')
  await expect(page.getByRole('list', { name: 'Tiến độ' }).getByRole('listitem')).toHaveCount(5)
})

test('TC-048 | sai SĐT hoặc sai mã cho cùng một thông báo, không lộ phiếu có tồn tại hay không', async ({ page }) => {
  const p = new PortalPage(page)
  const m1 = await p.lookupAndWait('CAS-20261106-0041', '0900000000')
  await page.reload()
  const m2 = await p.lookupAndWait('CAS-20990101-9999', '0912345678')
  expect(m1).toContain('Không tìm thấy phiếu')
  expect(m1).toBe(m2)
})

test('TC-047 TC-054 | trang của khách không hiện tên kỹ thuật viên, ghi chú nội bộ hay SĐT', async ({ page }) => {
  await new PortalPage(page).lookup('CAS-20261106-0041', '0912345678')
  await expect(page.getByTestId('case-code')).toBeVisible()
  const text = await page.locator('main').innerText()
  expect(text).not.toMatch(/Nguyễn Văn An|ktv|0912345678|IN_REPAIR/)
})

test('UC-16 | sai quá 5 lần thì phải trả lời câu hỏi xác nhận', async ({ page }) => {
  const p = new PortalPage(page)
  await page.goto('/#tra-cuu')
  await page.getByLabel('Mã phiếu').fill('CAS-20261106-0041')
  await page.getByLabel('Số điện thoại').fill('0900000000')
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: 'Tra cứu' }).click()
    await expect(p.message()).not.toBeEmpty()
  }
  await expect(page.getByLabel(/Xác nhận bạn không phải máy/)).toBeVisible()
})
