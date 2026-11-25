import { z } from 'zod'

// Schema thân yêu cầu của các endpoint. Đặt tên trường theo @woms/domain/types (tài liệu hợp nhất 12/11/2026).
const text = (max = 2000) => z.string().max(max).default('')
const req = (max = 500) => z.string().max(max)
const id = z.string().min(1).max(64)
const version = z.number().int().positive()
const money = z.number().finite()

export const photo = z.object({ name: z.string().max(200), src: z.string().max(3_000_000).optional() })
const photos = z.array(photo).max(10).default([])
const quote = z.object({ items: z.array(z.object({ label: z.string().max(200), qty: z.number(), unitPrice: money })).max(50), labor: money })
const task = z.object({ title: z.string().max(300), minutes: z.number().int().min(0).max(100_000) })
const partLine = z.object({ partId: id, qty: z.number() })

export const S = {
  login: z.object({ username: req(64), password: req(200) }),
  logout: z.object({ action: text(100) }),
  changePassword: z.object({ current: req(200), next: req(200) }),

  intake: z.object({
    customerId: id.optional(),
    customer: z.object({ name: text(200), phone: text(20), email: z.string().max(200).optional() }),
    deviceId: id.optional(),
    device: z.object({
      kind: z.enum(['laptop', 'pc', 'printer']),
      brand: text(100),
      model: text(100),
      serial: text(100),
      purchaseDate: z.string().max(40).optional(),
    }),
    symptom: text(2000),
    condition: text(2000),
    accessories: z.array(z.string().max(100)).max(30).default([]),
    noAccessories: z.boolean().default(false),
    photos,
  }),
  acceptOnline: z.object({
    version,
    condition: text(2000),
    accessories: z.array(z.string().max(100)).max(30).default([]),
    noAccessories: z.boolean().default(false),
    photos,
  }),
  reason: z.object({ version, reason: text() }),
  note: z.object({ version, note: text() }),
  versionOnly: z.object({ version }),
  precheck: z.object({ version, warranty: z.enum(['CON_HAN', 'HET_HAN', 'CHUA_DU_THONG_TIN']), note: text() }),
  assign: z.object({ version, techId: id, reason: z.string().max(1000).optional() }),
  diagnosis: z.object({
    version,
    cause: text(),
    causeType: z.enum(['PHAN_CUNG', 'PHAN_MEM', 'NUOC_ROI_VO', 'TU_THAO_LAP', 'CHUA_XAC_DINH']),
    severity: z.enum(['NHE', 'TRUNG_BINH', 'NANG']),
    repairable: z.boolean(),
    plan: text(),
    tasks: z.array(task).max(50).default([]),
    parts: z.array(partLine).max(50).default([]),
    laborEstimate: money.default(0),
  }),
  eligibility: z.object({
    version,
    decision: z.enum(['MIEN_PHI', 'CO_PHI', 'NGOAI_LE', 'KHONG_SUA']),
    ruleCode: req(10),
    reason: text(),
    quote: quote.optional(),
  }),
  quoteResponse: z.object({ version, accepted: z.boolean(), method: text(100), note: text() }),
  returnConclusion: z.object({ version, text: text(), feeAgreed: z.boolean().default(false) }),
  finishRepair: z.object({ version, used: z.record(z.string(), z.number()).default({}), note: text() }),
  planChange: z.object({
    version,
    finding: text(),
    newPlan: text(),
    addTasks: z.array(task).max(30).default([]),
    addParts: z.array(partLine).max(30).default([]),
    extraLabor: money.default(0),
  }),
  planReview: z.object({ version, result: z.enum(['MIEN_PHI', 'CO_PHI', 'KHONG_DONG_Y']), note: text(), quote: quote.optional() }),
  planResponse: z.object({ version, accepted: z.boolean(), method: text(100), note: text(), next: z.enum(['TIEP_TUC', 'TRA_MAY']).optional() }),
  qc: z.object({
    version,
    items: z.array(z.object({ label: z.string().max(200), mandatory: z.boolean().default(false), pass: z.boolean(), note: text(500) })).max(50),
    defect: text(),
    photos,
  }),
  handover: z.object({
    version,
    recipientName: text(200),
    recipientPhone: text(20),
    relation: z.enum(['CHINH_CHU', 'NHAN_HO']),
    idNote: text(300),
    accessoriesOk: z.boolean(),
    conditionOk: z.boolean(),
    inspectionFee: money.default(0),
    signed: z.boolean(),
    rating: z.number().int().min(1).max(5).optional(),
    feedback: z.string().max(2000).optional(),
  }),

  shortage: z.object({ note: text() }),
  woLog: z.object({ text: text() }),
  stockIn: z.object({ partId: id, qty: z.number(), note: text(), forPurchase: z.boolean().default(true) }),
  purchase: z.object({ partId: id, qty: z.number(), reason: text() }),
  adjust: z.object({ partId: id, counted: z.number(), reason: text() }),

  decision: z.object({ approve: z.boolean(), note: text(), option: z.enum(['SUA_TIEP', 'TRA_MAY']).optional() }),
  complaint: z.object({ caseId: id, content: text() }),
  complaintUpdate: z.object({ status: z.enum(['DANG_XU_LY', 'CHUYEN_QUAN_LY', 'DA_GIAI_QUYET']), resolution: text() }),
  user: z.object({
    name: text(200),
    username: text(64),
    role: z.enum(['TN', 'CSKH', 'DP', 'KTV', 'KHO', 'QC', 'QL']),
    phone: text(20),
    active: z.boolean().default(true),
  }),
  holiday: z.object({ date: req(10), name: text(200) }),

  publicLookup: z.object({ code: req(40), phone: req(20) }),
  publicRequest: z.object({
    customer: z.object({ name: text(200), phone: text(20), email: z.string().max(200).optional() }),
    device: z.object({
      kind: z.enum(['laptop', 'pc', 'printer']),
      brand: text(100),
      model: text(100),
      serial: text(100),
      purchaseDate: z.string().max(40).optional(),
    }),
    symptom: text(2000),
  }),
  publicQuote: z.object({ code: req(40), phone: req(20), otp: req(10), accepted: z.boolean() }),
}
