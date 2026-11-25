import * as http from './http'
import * as mock from './mock'
import { isHttp } from './mode'

// Lớp gọi dữ liệu mà giao diện dùng. Chọn backend thật (http.ts) hoặc bản chạy thử (mock.ts) theo VITE_API_URL.
// Hai bản cùng chữ ký; quy tắc nghiệp vụ nằm ở @woms/domain và được backend kiểm lại (BR-27, AT-14).
const impl: typeof mock = isHttp ? (http as unknown as typeof mock) : mock

export const {
  login,
  logAudit,
  changePassword,
  saveUser,
  resetPassword,
  createCase,
  acceptOnline,
  requestCancel,
  savePrecheck,
  requestInfo,
  infoSupplied,
  assignDiagnosis,
  assignRepair,
  submitDiagnosis,
  decideEligibility,
  sendApprovedQuote,
  recordQuoteResponse,
  confirmReturn,
  reserveParts,
  markShortage,
  issueParts,
  confirmPartReturn,
  stockIn,
  requestPurchase,
  requestAdjust,
  startRepair,
  toggleTask,
  addWoLog,
  finishRepair,
  proposePlanChange,
  reviewPlanChange,
  sendPlanChangeQuote,
  respondPlanChange,
  submitQc,
  handover,
  decideApproval,
  createComplaint,
  updateComplaint,
  addHoliday,
  removeHoliday,
  fetchWorkspace,
} = impl

export { ApiError } from '@/domain/errors'
export { allowedDecisions, nameOf, serialOwnedMessage } from '@/domain/commands'
export type { IntakeInput, PlanChangeInput, QuoteInput } from '@/domain/commands'
