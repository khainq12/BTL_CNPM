// Mô hình dữ liệu phía frontend. Đặt tên theo tài liệu hợp nhất WOMS (12/11/2026).
// Khi TV4/TV5 chốt Swagger và schema, đối chiếu lại tên trường ở đây.

export type Role = 'TN' | 'CSKH' | 'DP' | 'KTV' | 'KHO' | 'QC' | 'QL'

export type User = {
  id: string
  username: string
  password: string // chỉ có trong dữ liệu giả; backend thật lưu bcrypt (NFR-01)
  name: string
  role: Role
  phone: string
  active: boolean
}

export type Customer = { id: string; name: string; phone: string; email?: string }

export type DeviceKind = 'laptop' | 'pc' | 'printer'

export type Device = {
  id: string
  customerId: string
  kind: DeviceKind
  brand: string
  model: string
  serial: string
  purchaseDate?: string // ISO; thiếu nghĩa là chưa có chứng từ
  warrantyMonths: number
  policyCode: string
}

export type CaseStatus =
  | 'DRAFT'
  | 'PENDING_ACCEPT'
  | 'RECEIVED'
  | 'PRECHECK'
  | 'WAITING_INFORMATION'
  | 'DIAGNOSING'
  | 'ELIGIBILITY_REVIEW'
  | 'WAITING_APPROVAL'
  | 'QUOTED'
  | 'WO_CREATED'
  | 'WAITING_PARTS'
  | 'READY_TO_REPAIR'
  | 'ASSIGNED'
  | 'IN_REPAIR'
  | 'TESTING'
  | 'REWORK'
  | 'MANAGER_REVIEW'
  | 'RETURN_PENDING'
  | 'READY_FOR_DELIVERY'
  | 'COMPLETED'
  | 'CANCELLED'

export type Channel = 'QUAY' | 'ONLINE'

export type WarrantyCheck = 'CON_HAN' | 'HET_HAN' | 'CHUA_DU_THONG_TIN'

export type Precheck = { warranty: WarrantyCheck; note: string; by: string; at: string }

export type CauseType = 'PHAN_CUNG' | 'PHAN_MEM' | 'NUOC_ROI_VO' | 'TU_THAO_LAP' | 'CHUA_XAC_DINH'

export type Diagnosis = {
  cause: string
  causeType: CauseType
  severity: 'NHE' | 'TRUNG_BINH' | 'NANG'
  repairable: boolean
  plan: string
  tasks: { title: string; minutes: number }[]
  parts: { partId: string; qty: number }[]
  laborEstimate: number
  by: string
  at: string
}

export type EligibilityDecision = 'MIEN_PHI' | 'CO_PHI' | 'NGOAI_LE' | 'KHONG_SUA'

export type Eligibility = {
  decision: EligibilityDecision
  ruleCode: string // D1..D10
  reason: string
  policyCode: string
  exceptionApproved?: boolean
  by: string
  at: string
}

export type QuoteStatus = 'CHO_DUYET' | 'DA_DUYET' | 'TU_CHOI_DUYET' | 'DA_GUI' | 'KHACH_DONG_Y' | 'KHACH_TU_CHOI'

export type Quote = {
  version: number
  planChangeNo?: number // báo giá bổ sung khi đổi phương án giữa chừng (BR-12)
  items: { label: string; qty: number; unitPrice: number }[]
  labor: number
  total: number
  status: QuoteStatus
  confirmMethod?: string
  confirmNote?: string
  createdBy: string
  createdAt: string
  sentAt?: string
  respondedAt?: string
}

export type QcItem = { label: string; mandatory: boolean; pass: boolean; note: string }

export type QcResult = { round: number; items: QcItem[]; pass: boolean; defect?: string; photos?: Photo[]; by: string; at: string }

// Ảnh đính kèm. Bản chạy thử nén ảnh và lưu dạng data URL; bản thật upload lên kho tệp của backend và chỉ giữ đường dẫn.
export type Photo = { name: string; src?: string }

export type Handover = {
  recipientName: string
  recipientPhone: string
  relation: 'CHINH_CHU' | 'NHAN_HO'
  idNote: string
  accessoriesOk: boolean
  conditionOk: boolean
  inspectionFee: number
  signed: boolean
  rating?: number
  feedback?: string
  withoutRepair: boolean
  by: string
  at: string
}

export type Pause = { reason: 'CHO_LINH_KIEN' | 'CHO_XAC_NHAN_GIA'; start: string; end?: string }

export type CaseEvent = {
  at: string
  by: string
  action: string
  from?: CaseStatus
  to?: CaseStatus
  note?: string
}

export type WarrantyCase = {
  id: string
  code: string
  version: number
  status: CaseStatus
  customerId: string
  deviceId: string
  channel: Channel
  symptom: string
  condition: string
  accessories: string[]
  noAccessories: boolean
  photos: Photo[]
  createdAt: string
  receivedAt?: string
  receivedBy?: string
  diagnosisTechId?: string
  precheck?: Precheck
  infoRequest?: string
  diagnosis?: Diagnosis
  eligibility?: Eligibility
  quotes: Quote[]
  workOrderId?: string
  reworkCount: number
  qc: QcResult[]
  returnConclusion?: { text: string; feeAgreed: boolean; by: string; at: string }
  readyAt?: string
  handover?: Handover
  sla: { planConfirmedAt?: string; pauses: Pause[] }
  cancelReason?: string
  pendingApprovalId?: string
  planChanges?: PlanChange[]
  events: CaseEvent[]
}

// Đổi phương án khi đang sửa (BR-12). Phiếu vẫn ở IN_REPAIR; tiến trình xét duyệt là trạng thái phụ của đề xuất.
export type PlanChangeStatus = 'CHO_CSKH' | 'CHO_DUYET' | 'CHO_GUI' | 'CHO_KHACH' | 'DA_AP_DUNG' | 'TU_CHOI'

export type PlanChange = {
  id: string
  no: number
  status: PlanChangeStatus
  finding: string
  oldPlan: string
  newPlan: string
  addTasks: { title: string; minutes: number }[]
  addParts: { partId: string; qty: number }[]
  extraLabor: number
  proposedBy: string
  proposedAt: string
  charge?: 'MIEN_PHI' | 'CO_PHI'
  reviewNote?: string
  reviewedBy?: string
  reviewedAt?: string
  quoteVersion?: number
  outcome?: string
  closedAt?: string
}

export type WoTask = { id: string; title: string; minutes: number; done: boolean; doneAt?: string }

export type WoPart = {
  partId: string
  qty: number
  reserved: number
  issued: number
  used: number
  returnPending: number
  returned: number
}

export type WorkOrder = {
  id: string
  code: string
  caseId: string
  tasks: WoTask[]
  parts: WoPart[]
  technicianId?: string
  assignHistory: { from?: string; to: string; reason?: string; by: string; at: string }[]
  logs: { at: string; by: string; text: string }[]
  createdAt: string
  startedAt?: string
  finishedAt?: string
}

export type Part = {
  id: string
  sku: string
  name: string
  unit: string
  onHand: number
  reserved: number
  location: string
  price: number
  fits: string
}

export type StockMoveType = 'NHAP' | 'GIU' | 'BO_GIU' | 'XUAT' | 'TRA' | 'DIEU_CHINH'

export type StockMove = {
  id: string
  at: string
  by: string
  type: StockMoveType
  partId: string
  qty: number
  woCode?: string
  note?: string
}

export type ApprovalType =
  | 'NGOAI_LE_BH'
  | 'BAO_GIA'
  | 'MUA_LINH_KIEN'
  | 'DIEU_CHINH_KHO'
  | 'HUY_HO_SO'
  | 'XEM_XET_QC'

export type Approval = {
  id: string
  type: ApprovalType
  caseId?: string
  planChangeId?: string
  partId?: string
  qty?: number
  title: string
  detail: string
  requestedBy: string
  requestedAt: string
  status: 'CHO_DUYET' | 'DA_DUYET' | 'TU_CHOI'
  decidedBy?: string
  decidedAt?: string
  decisionNote?: string
  decisionOption?: string
}

export type Complaint = {
  id: string
  code: string
  caseId: string
  content: string
  status: 'MOI' | 'DANG_XU_LY' | 'CHUYEN_QUAN_LY' | 'DA_GIAI_QUYET'
  resolution?: string
  log?: { at: string; by: string; status: Complaint['status']; text: string }[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

// Ngày nghỉ lễ không tính vào hạn xử lý (lịch làm việc, mục 6.3). Ngày theo giờ Việt Nam, dạng yyyy-MM-dd.
export type Holiday = { date: string; name: string }

export type AuditEntry = {
  id: string
  at: string
  by: string
  entity: 'PHIEU' | 'WO' | 'KHO' | 'PHE_DUYET' | 'TAI_KHOAN' | 'KHIEU_NAI' | 'PHIEN' | 'CAU_HINH'
  ref: string
  action: string
  detail?: string
}
