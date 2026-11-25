import * as C from '../src/commands'
import { createSeedDb, type Db } from '../src/db'
import { QC_CHECKLIST } from '../src/rules'
import { setHolidays } from '../src/sla'
import type { Diagnosis, User, WarrantyCase } from '../src/types'

// Bộ dựng kịch bản nghiệp vụ cho kiểm thử: chạy đúng các lệnh thật trên dữ liệu mẫu, mỗi bước bằng đúng vai trò.
export function newDb(): Db {
  const db = createSeedDb()
  setHolidays(db.holidays.map((h) => h.date))
  return db
}

export const user = (db: Db, username: string): User => {
  const u = db.users.find((x) => x.username === username)
  if (!u) throw new Error(`Không có tài khoản ${username}`)
  return u
}

let serialSeq = 0
export const intakeInput = (over: Partial<C.IntakeInput> = {}): C.IntakeInput => ({
  customer: { name: 'Khách Kiểm Thử', phone: '0911000001' },
  device: { kind: 'laptop', brand: 'Lenovo', model: 'ThinkPad T14', serial: `TST${Date.now().toString(36)}${++serialSeq}`.toUpperCase() },
  symptom: 'Không lên nguồn',
  condition: 'Nguyên vẹn',
  accessories: ['Sạc / adapter'],
  noAccessories: false,
  photos: [{ name: 'mat-truoc.jpg' }],
  ...over,
})

export const diagnosisInput = (over: Partial<Omit<Diagnosis, 'by' | 'at'>> = {}): Omit<Diagnosis, 'by' | 'at'> => ({
  cause: 'Hỏng IC nguồn trên bo mạch',
  causeType: 'PHAN_CUNG',
  severity: 'TRUNG_BINH',
  repairable: true,
  plan: 'Thay IC nguồn',
  tasks: [
    { title: 'Tháo máy, thay IC nguồn', minutes: 60 },
    { title: 'Chạy thử', minutes: 30 },
  ],
  parts: [],
  laborEstimate: 300_000,
  ...over,
})

export const qcItems = (kind: 'laptop' | 'pc' | 'printer', pass = true) => QC_CHECKLIST[kind].map((i) => ({ ...i, pass: i.mandatory ? pass : true, note: '' }))

export const handoverInput = (over: Partial<Parameters<typeof C.handover>[4]> = {}) => ({
  recipientName: 'Khách Kiểm Thử',
  recipientPhone: '0911000001',
  relation: 'CHINH_CHU' as const,
  idNote: 'Đối chiếu CCCD',
  accessoriesOk: true,
  conditionOk: true,
  inspectionFee: 0,
  signed: true,
  ...over,
})

// Một phiếu đi qua quy trình 6.1 (8 bước). Mỗi hàm đưa phiếu tới một trạng thái, dùng lại cho nhiều kịch bản.
export class Flow {
  readonly c: WarrantyCase
  constructor(
    readonly db: Db,
    input: C.IntakeInput = intakeInput()
  ) {
    this.c = C.createCase(db, user(db, 'tiepnhan'), input, `key-${Math.random()}`)
  }
  get case() {
    return this.db.cases.find((x) => x.id === this.c.id)!
  }
  get v() {
    return this.case.version
  }
  get wo() {
    return this.db.workOrders.find((w) => w.id === this.case.workOrderId)!
  }
  precheck(warranty: 'CON_HAN' | 'HET_HAN' | 'CHUA_DU_THONG_TIN' = 'CON_HAN') {
    C.savePrecheck(this.db, user(this.db, 'cskh'), this.c.id, this.v, { warranty, note: 'Kiểm tra tem, chứng từ' })
    return this
  }
  assignDiagnosis(tech = 'u-ktv1') {
    C.assignDiagnosis(this.db, user(this.db, 'dieuphoi'), this.c.id, this.v, tech)
    return this
  }
  diagnose(over: Partial<Omit<Diagnosis, 'by' | 'at'>> = {}, tech = 'ktv.an') {
    C.submitDiagnosis(this.db, user(this.db, tech), this.c.id, this.v, diagnosisInput(over))
    return this
  }
  toEligibility(over: Partial<Omit<Diagnosis, 'by' | 'at'>> = {}) {
    return this.precheck().assignDiagnosis().diagnose(over)
  }
  free(rule = 'D1') {
    C.decideEligibility(this.db, user(this.db, 'cskh'), this.c.id, this.v, {
      decision: 'MIEN_PHI',
      ruleCode: rule,
      reason: 'Lỗi phần cứng trong phạm vi bảo hành',
    })
    return this
  }
  reserve() {
    C.reserveParts(this.db, user(this.db, 'kho'), this.wo.id)
    return this
  }
  assignRepair(tech = 'u-ktv1', reason?: string) {
    C.assignRepair(this.db, user(this.db, 'dieuphoi'), this.c.id, this.v, tech, reason)
    return this
  }
  issue() {
    C.issueParts(this.db, user(this.db, 'kho'), this.wo.id)
    return this
  }
  start(tech = 'ktv.an') {
    C.startRepair(this.db, user(this.db, tech), this.c.id, this.v)
    return this
  }
  doTasks(tech = 'ktv.an') {
    for (const t of this.wo.tasks.filter((x) => !x.done)) C.toggleTask(this.db, user(this.db, tech), this.wo.id, t.id)
    return this
  }
  finish(tech = 'ktv.an', used: Record<string, number> = {}) {
    C.finishRepair(this.db, user(this.db, tech), this.c.id, this.v, used, 'Đã thay, chạy thử ổn')
    return this
  }
  qc(pass = true, defect = '') {
    const kind = this.db.devices.find((d) => d.id === this.case.deviceId)!.kind
    C.submitQc(this.db, user(this.db, 'qc'), this.c.id, this.v, qcItems(kind, pass), defect)
    return this
  }
  handover(over = {}) {
    C.handover(this.db, user(this.db, 'tiepnhan'), this.c.id, this.v, handoverInput(over))
    return this
  }
  // Đi hết luồng sửa miễn phí, không cần linh kiện, tới chờ QC.
  toTesting() {
    return this.toEligibility().free().assignRepair().start().doTasks().finish()
  }
}
