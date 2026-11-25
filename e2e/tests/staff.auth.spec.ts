import { expect, test } from '@playwright/test'
import { Api } from '../support/api'
import { CasePage, Sidebar, SignInPage } from '../support/pages'

// Đăng nhập và phân quyền trên giao diện nội bộ (NFR-01, ma trận phân quyền 5.3).

test.describe('Đăng nhập @smoke', () => {
  test('MAN-L01 TC-045 | đăng nhập đúng vào hộp việc theo vai trò', async ({ page }) => {
    await new SignInPage(page).loginOk('tiepnhan')
    await expect(page.getByText('Lê Thu Hà').first()).toBeVisible()
  })

  test('MAN-L02 | sai mật khẩu báo lỗi chung, không vào được', async ({ page }) => {
    const s = new SignInPage(page)
    await s.login('tiepnhan', 'sai-mat-khau')
    await expect(s.error()).toContainText('Tên đăng nhập hoặc mật khẩu không đúng')
    await expect(page).toHaveURL(/sign-in/)
  })

  test('MAN-L03 | tài khoản đã khóa bị từ chối', async ({ page }) => {
    const s = new SignInPage(page)
    await s.login('tiepnhan2')
    await expect(s.error()).toContainText('khóa')
  })

  test('chưa đăng nhập mở trang nội bộ thì chuyển về trang đăng nhập', async ({ page }) => {
    await page.goto('/phieu')
    await expect(page).toHaveURL(/sign-in/)
  })
})

test.describe('Menu theo vai trò', () => {
  const cases: [string, string[], string[]][] = [
    ['tiepnhan', ['Tạo phiếu tiếp nhận', 'Chờ bàn giao'], ['Phê duyệt', 'Bảng điều hành', 'Tài khoản và phân quyền']],
    ['ktv.an', ['Việc của tôi'], ['Tạo phiếu tiếp nhận', 'Phê duyệt', 'Khách hàng']],
    ['kho', ['Yêu cầu linh kiện', 'Kiểm kê'], ['Phê duyệt', 'Tạo phiếu tiếp nhận']],
    ['quanly', ['Phê duyệt', 'Bảng điều hành', 'Nhật ký thao tác'], ['Tạo phiếu tiếp nhận', 'Việc của tôi']],
  ]
  for (const [user, visible, hidden] of cases) {
    test(`TC-045 | ${user} chỉ thấy chức năng của vai trò mình`, async ({ page }) => {
      await new SignInPage(page).loginOk(user)
      const nav = new Sidebar(page)
      for (const v of visible) await expect(nav.link(v)).toBeVisible()
      for (const h of hidden) await expect(nav.link(h)).toHaveCount(0)
    })
  }

  test('TC-046 | KTV mở phiếu không được giao (biết mã/đường dẫn) vẫn bị chặn', async ({ page }) => {
    const api = await Api.create()
    const c = await api.caseAt('DIAGNOSING') // giao ktv.an
    await api.dispose()
    await new SignInPage(page).loginOk('ktv.binh')
    await new CasePage(page).open(c.id)
    await expect(page.getByText('Không mở được phiếu')).toBeVisible()
    await expect(page.getByText(c.code)).toHaveCount(0)
  })

  test('KTV vào trang quản trị bằng đường dẫn thì thấy thông báo không có quyền', async ({ page }) => {
    await new SignInPage(page).loginOk('ktv.an')
    await page.goto('/quan-tri/tai-khoan')
    await expect(page.getByText('Không có quyền truy cập')).toBeVisible()
  })
})
