// Tham số nghiệp vụ (Phần 5.5, PARAM-01..18) – giá trị đề xuất, có thể cấu hình.
export const PARAMS = {
  warrantyAfterRepairMonths: 6, // PARAM-01
  defaultWarrantyMonths: 12, // PARAM-02
  quoteApprovalThreshold: 2_000_000, // PARAM-03
  quoteWaitDays: 5, // PARAM-04
  pickupHoldDays: 30, // PARAM-05
  minStock: 5, // PARAM-06
  inspectionFee: 100_000, // PARAM-07
  repairSlaDays: 3, // PARAM-08
  warnBeforeMinutes: 4 * 60, // PARAM-09
  maxRework: 2, // PARAM-10
  partWaitWarnDays: 3, // PARAM-15
  pauseQuoteMaxDays: 5, // PARAM-16
  pausePartsMaxDays: 3, // PARAM-17
  technicianOverload: 5, // UC-10: trên 5 WO dở dang thì cảnh báo
  sessionHours: 8, // suy luận: một ca làm việc
}

// Lịch làm việc NFR-04: 08:00–17:30, Thứ 2 – Thứ 7, giờ Việt Nam.
export const WORK_START_MIN = 8 * 60
export const WORK_END_MIN = 17 * 60 + 30
export const WORK_DAY_MINUTES = WORK_END_MIN - WORK_START_MIN // 570
