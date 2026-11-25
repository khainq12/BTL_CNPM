import { expect, request, type APIRequestContext } from '@playwright/test'

// Dựng dữ liệu điều kiện đầu cho kịch bản E2E qua API thật (nhanh và ổn định hơn bấm giao diện), đúng vai trò từng bước.
// Bước đang được kiểm thử thì thao tác trên giao diện.
export const API_URL = 'http://localhost:3100'
export const PASSWORD = 'Woms@2026'

type Brief = { id: string; code: string; version: number; status: string }

export class Api {
  private tokens = new Map<string, string>()
  private constructor(private readonly ctx: APIRequestContext) {}

  static async create() {
    return new Api(await request.newContext({ baseURL: `${API_URL}/api/v1/` }))
  }

  async dispose() {
    await this.ctx.dispose()
  }

  private async token(user: string) {
    if (!this.tokens.has(user)) {
      const r = await this.ctx.post('auth/login', { data: { username: user, password: PASSWORD } })
      expect(r.status(), `đăng nhập ${user}`).toBe(200)
      this.tokens.set(user, (await r.json()).accessToken)
    }
    return this.tokens.get(user)!
  }

  async call<T = Brief>(
    user: string,
    method: 'get' | 'post' | 'put' | 'patch',
    path: string,
    data?: unknown,
    headers: Record<string, string> = {}
  ): Promise<T> {
    const r = await this.ctx.fetch(path.replace(/^\//, ''), {
      method: method.toUpperCase(),
      data,
      headers: { Authorization: `Bearer ${await this.token(user)}`, ...headers },
    })
    expect(r.ok(), `${method.toUpperCase()} ${path} → ${r.status()} ${await r.text()}`).toBeTruthy()
    return (r.status() === 204 ? undefined : await r.json()) as T
  }

  async detail(id: string) {
    return this.call<{ case: Brief & { workOrderId?: string }; workOrder?: { id: string; tasks: { id: string; done: boolean }[] } }>(
      'quanly',
      'get',
      `/cases/${id}`
    )
  }

  async createCase(over: { phone?: string; name?: string } = {}) {
    const n = Date.now().toString().slice(-7)
    return this.call(
      'tiepnhan',
      'post',
      '/cases',
      {
        customer: { name: over.name ?? 'Khách E2E', phone: over.phone ?? `098${n}` },
        device: { kind: 'laptop', brand: 'Asus', model: 'VivoBook 15', serial: `E2E${Date.now().toString(36).toUpperCase()}` },
        symptom: 'Màn hình nhấp nháy',
        condition: 'Nguyên vẹn',
        accessories: ['Sạc / adapter'],
        noAccessories: false,
        photos: [{ name: 'e2e.jpg' }],
      },
      { 'Idempotency-Key': `e2e-${Date.now()}-${Math.random()}` }
    )
  }

  // Đưa phiếu tới trạng thái mong muốn theo quy trình 6.1 (miễn phí, không linh kiện).
  async caseAt(
    target: 'RECEIVED' | 'PRECHECK' | 'DIAGNOSING' | 'ELIGIBILITY_REVIEW' | 'READY_TO_REPAIR' | 'IN_REPAIR' | 'TESTING' | 'READY_FOR_DELIVERY',
    phone?: string
  ) {
    let c = await this.createCase({ phone })
    const order = ['RECEIVED', 'PRECHECK', 'DIAGNOSING', 'ELIGIBILITY_REVIEW', 'READY_TO_REPAIR', 'IN_REPAIR', 'TESTING', 'READY_FOR_DELIVERY']
    const go = async (s: string) => order.indexOf(target) >= order.indexOf(s)
    if (await go('PRECHECK')) c = await this.call('cskh', 'put', `/cases/${c.id}/precheck`, { version: c.version, warranty: 'CON_HAN', note: 'E2E' })
    if (await go('DIAGNOSING')) c = await this.call('dieuphoi', 'put', `/cases/${c.id}/diagnosis-assignment`, { version: c.version, techId: 'u-ktv1' })
    if (await go('ELIGIBILITY_REVIEW'))
      c = await this.call('ktv.an', 'put', `/cases/${c.id}/diagnosis`, {
        version: c.version,
        cause: 'Lỏng cáp màn hình',
        causeType: 'PHAN_CUNG',
        severity: 'NHE',
        repairable: true,
        plan: 'Cắm lại cáp màn hình',
        tasks: [{ title: 'Cắm lại cáp màn hình', minutes: 20 }],
        parts: [],
        laborEstimate: 0,
      })
    if (await go('READY_TO_REPAIR'))
      c = await this.call('cskh', 'put', `/cases/${c.id}/eligibility`, {
        version: c.version,
        decision: 'MIEN_PHI',
        ruleCode: 'D1',
        reason: 'Còn hạn, lỗi phần cứng',
      })
    if (await go('IN_REPAIR')) {
      c = await this.call('dieuphoi', 'put', `/cases/${c.id}/repair-assignment`, { version: c.version, techId: 'u-ktv1' })
      c = await this.call('ktv.an', 'post', `/cases/${c.id}/repair/start`, { version: c.version })
    }
    if (await go('TESTING')) {
      const d = await this.detail(c.id)
      for (const t of d.workOrder!.tasks) await this.call('ktv.an', 'patch', `/work-orders/${d.workOrder!.id}/tasks/${encodeURIComponent(t.id)}/toggle`)
      c = await this.call('ktv.an', 'post', `/cases/${c.id}/repair/finish`, { version: (await this.detail(c.id)).case.version, used: {}, note: '' })
    }
    if (await go('READY_FOR_DELIVERY')) {
      const items = [
        'Lên nguồn, khởi động vào hệ điều hành',
        'Lỗi khách báo đã được khắc phục',
        'Màn hình hiển thị bình thường',
        'Bàn phím, touchpad hoạt động',
        'Sạc pin, nhận adapter',
        'Vỏ máy không phát sinh trầy xước mới',
      ].map((label) => ({ label, mandatory: true, pass: true, note: '' }))
      c = await this.call('qc', 'post', `/cases/${c.id}/qc`, { version: c.version, items, defect: '' })
    }
    expect(c.status).toBe(target)
    return c
  }
}
