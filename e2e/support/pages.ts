import { expect, type Page } from '@playwright/test'
import { PASSWORD } from './api'

// Page Object: gom cách thao tác với từng màn hình, để khi giao diện đổi chỉ sửa ở một chỗ.

export class SignInPage {
  constructor(private readonly page: Page) {}
  async open() {
    await this.page.goto('/sign-in')
  }
  async login(username: string, password = PASSWORD) {
    await this.open()
    await this.page.getByLabel('Tên đăng nhập').fill(username)
    await this.page.getByLabel('Mật khẩu').fill(password)
    await this.page.getByRole('button', { name: 'Đăng nhập' }).click()
  }
  async loginOk(username: string) {
    await this.login(username)
    await expect(this.page.getByRole('heading', { name: 'Hộp việc' })).toBeVisible()
  }
  error() {
    return this.page.getByRole('alert')
  }
}

export class Sidebar {
  constructor(private readonly page: Page) {}
  // Mục menu có thể kèm huy hiệu đếm số việc ("Việc của tôi 2").
  link(name: string) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return this.page.locator('[data-sidebar="content"]').getByRole('link', { name: new RegExp(`^${esc}(\\s*\\d+)?$`) })
  }
}

export class CasePage {
  constructor(private readonly page: Page) {}
  async open(id: string) {
    await this.page.goto(`/phieu/${id}`)
  }
  action(name: string) {
    return this.page.getByRole('button', { name, exact: true }).first()
  }
  dialog() {
    return this.page.getByRole('dialog')
  }
  status(label: string) {
    return this.page.getByText(label, { exact: true }).first()
  }
}

export class IntakePage {
  constructor(private readonly page: Page) {}
  async open() {
    await this.page.goto('/tiep-nhan/moi')
    await expect(this.page.getByRole('heading', { name: 'Tạo phiếu tiếp nhận' })).toBeVisible()
  }
  async fill(d: { phone: string; name: string; brand: string; model: string; serial: string; symptom: string; condition: string }) {
    const p = this.page
    await p.getByLabel('Số điện thoại').fill(d.phone)
    await p.getByLabel('Họ tên khách').fill(d.name)
    await p.getByLabel('Loại thiết bị').selectOption('laptop')
    await p.getByLabel('Hãng').fill(d.brand)
    await p.getByLabel('Model').fill(d.model)
    await p.getByLabel('Serial').fill(d.serial)
    await p.getByLabel('Khách báo lỗi gì').fill(d.symptom)
    await p.getByLabel('Tình trạng bên ngoài').fill(d.condition)
    await p.getByText('Sạc / adapter', { exact: true }).click()
    // Ảnh hiện trạng: PNG 1x1 hợp lệ.
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
    await p.locator('input[type=file]').first().setInputFiles({ name: 'hien-trang.png', mimeType: 'image/png', buffer: png })
  }
  submit() {
    return this.page.getByRole('button', { name: 'Tạo phiếu tiếp nhận' }).click()
  }
}

export class PortalPage {
  constructor(private readonly page: Page) {}
  async lookup(code: string, phone: string) {
    await this.page.goto('/#tra-cuu')
    await this.page.getByLabel('Mã phiếu').fill(code)
    await this.page.getByLabel('Số điện thoại').fill(phone)
    await this.page.getByRole('button', { name: 'Tra cứu' }).click()
  }
  message() {
    return this.page.getByRole('alert').first()
  }
  // Tra cứu và chờ máy chủ trả lời (không đọc thông báo cũ trên trang).
  async lookupAndWait(code: string, phone: string) {
    const res = this.page.waitForResponse((r) => r.url().includes('/public/lookup'))
    await this.lookup(code, phone)
    await res
    await expect(this.message()).not.toBeEmpty()
    return (await this.message().textContent())!.trim()
  }
}
