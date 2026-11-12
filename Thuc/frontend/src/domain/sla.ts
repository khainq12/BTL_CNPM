import { PARAMS, WORK_DAY_MINUTES, WORK_END_MIN, WORK_START_MIN } from './params'
import type { Pause, WarrantyCase } from './types'

// Tính thời hạn theo giờ làm việc (NFR-04, PARAM-08/09/16/17, quyết định C16–C18).
// Việt Nam không đổi giờ mùa hè nên dùng lệch cố định UTC+7.
const OFFSET = 7 * 60 * 60 * 1000
const DAY = 24 * 60 * 60 * 1000

function vn(ms: number) {
  const t = new Date(ms + OFFSET)
  return {
    dow: t.getUTCDay(),
    date: t.toISOString().slice(0, 10),
    min: t.getUTCHours() * 60 + t.getUTCMinutes() + t.getUTCSeconds() / 60,
    dayStart: ms + OFFSET - ((ms + OFFSET) % DAY) - OFFSET,
  }
}

// Ngày nghỉ lễ do quản lý khai báo ở màn "Lịch làm việc". Lớp dữ liệu nạp vào đây mỗi khi đọc/ghi.
let holidays = new Set<string>()
export function setHolidays(dates: string[]) {
  holidays = new Set(dates)
}

const isWorkDay = (v: { dow: number; date: string }) => v.dow !== 0 && !holidays.has(v.date) // Thứ 2 – Thứ 7, trừ ngày lễ

export function workingMinutesBetween(a: number, b: number): number {
  if (b <= a) return 0
  let total = 0
  let cursor = a
  for (let i = 0; i < 400 && cursor < b; i++) {
    const v = vn(cursor)
    const { min, dayStart } = v
    const nextDay = dayStart + DAY
    if (isWorkDay(v)) {
      const from = Math.max(min, WORK_START_MIN)
      const endOfToday = Math.min(WORK_END_MIN, b >= nextDay ? WORK_END_MIN : vn(b).min)
      if (endOfToday > from) total += endOfToday - from
    }
    cursor = nextDay
  }
  return total
}

export function addWorkingMinutes(start: number, minutes: number): number {
  let left = minutes
  let cursor = start
  for (let i = 0; i < 400; i++) {
    const v = vn(cursor)
    const { min, dayStart } = v
    if (isWorkDay(v) && min < WORK_END_MIN) {
      const from = Math.max(min, WORK_START_MIN)
      const avail = WORK_END_MIN - from
      if (left <= avail) return dayStart + (from + left) * 60_000
      left -= avail
    }
    cursor = dayStart + DAY
  }
  return cursor
}

const PAUSE_CAP = {
  CHO_LINH_KIEN: PARAMS.pausePartsMaxDays * WORK_DAY_MINUTES,
  CHO_XAC_NHAN_GIA: PARAMS.pauseQuoteMaxDays * WORK_DAY_MINUTES,
}

function pauseMinutes(p: Pause, now: number) {
  const raw = workingMinutesBetween(Date.parse(p.start), p.end ? Date.parse(p.end) : now)
  return { raw, effective: Math.min(raw, PAUSE_CAP[p.reason]), overCap: raw > PAUSE_CAP[p.reason] }
}

export type SlaKind = 'not_started' | 'ok' | 'soon' | 'overdue' | 'paused' | 'stopped' | 'pickup' | 'pickup_late'

export type SlaInfo = { kind: SlaKind; label: string; detail: string; dueAt?: string; remaining?: number }

const STOP_STATUSES = ['READY_FOR_DELIVERY', 'COMPLETED', 'CANCELLED', 'RETURN_PENDING']

export function slaInfo(c: WarrantyCase, now = Date.now()): SlaInfo {
  if (c.status === 'READY_FOR_DELIVERY' && c.readyAt) {
    const days = Math.floor((now - Date.parse(c.readyAt)) / DAY)
    return days > PARAMS.pickupHoldDays
      ? { kind: 'pickup_late', label: `Chờ nhận ${days} ngày`, detail: `Quá ${PARAMS.pickupHoldDays} ngày lưu giữ (PARAM-05). Báo CSKH và quản lý.` }
      : { kind: 'pickup', label: `Chờ khách nhận ${days} ngày`, detail: 'Thời hạn xử lý đã dừng khi thiết bị sẵn sàng bàn giao.' }
  }
  if (c.status === 'COMPLETED' || c.status === 'CANCELLED') return { kind: 'stopped', label: 'Đã kết thúc', detail: '' }
  if (!c.sla.planConfirmedAt)
    return { kind: 'not_started', label: 'Chưa tính hạn', detail: 'Hạn 3 ngày làm việc bắt đầu khi phương án sửa được xác nhận (PARAM-08).' }

  const start = Date.parse(c.sla.planConfirmedAt)
  const pauses = c.sla.pauses.map((p) => ({ p, ...pauseMinutes(p, now) })).sort((a, b) => a.p.start.localeCompare(b.p.start))
  // Cộng dần từng khoảng tạm dừng. Khoảng bắt đầu sau khi đã quá hạn thì không dời hạn: tạm dừng không xóa vi phạm đã xảy ra.
  let due = addWorkingMinutes(start, PARAMS.repairSlaDays * WORK_DAY_MINUTES)
  const counted = new Set<Pause>()
  for (const x of pauses) {
    if (Date.parse(x.p.start) >= due) continue
    due = addWorkingMinutes(due, x.effective)
    counted.add(x.p)
  }
  const dueAt = new Date(due).toISOString()
  const active = pauses.find((x) => !x.p.end)

  if (STOP_STATUSES.includes(c.status)) return { kind: 'stopped', label: 'Đã dừng tính', detail: '', dueAt }

  if (active && !counted.has(active.p) && now > due) {
    const over = workingMinutesBetween(due, now)
    return { kind: 'overdue', label: `Quá hạn ${Math.ceil(over / 60)} giờ`, detail: 'Đã quá hạn trước khi tạm dừng, thời gian tạm dừng không dời hạn.', dueAt, remaining: -over }
  }
  if (active && !active.overCap) {
    const reason = active.p.reason === 'CHO_LINH_KIEN' ? 'chờ linh kiện' : 'chờ khách xác nhận lại giá'
    const left = PAUSE_CAP[active.p.reason] - active.raw
    return {
      kind: 'paused',
      label: 'Tạm dừng',
      detail: `Đang ${reason}. Còn ${Math.ceil(left / 60)} giờ làm việc trước khi hết giới hạn tạm dừng.`,
      dueAt,
    }
  }
  if (now > due) {
    const over = workingMinutesBetween(due, now)
    return { kind: 'overdue', label: `Quá hạn ${Math.ceil(over / 60)} giờ`, detail: 'Đã vượt hạn 3 ngày làm việc kể từ khi xác nhận phương án.', dueAt, remaining: -over }
  }
  const remaining = workingMinutesBetween(now, due)
  const extra = active?.overCap ? ' Đã vượt giới hạn tạm dừng, phần vượt vẫn tính vào hạn.' : ''
  if (remaining <= PARAMS.warnBeforeMinutes)
    return { kind: 'soon', label: `Còn ${Math.max(1, Math.ceil(remaining / 60))} giờ`, detail: `Sắp quá hạn (còn ≤ 4 giờ làm việc).${extra}`, dueAt, remaining }
  return { kind: 'ok', label: `Còn ${Math.ceil(remaining / 60)} giờ`, detail: `Tính theo giờ làm việc 08:00–17:30, Thứ 2–Thứ 7, trừ ngày lễ.${extra}`, dueAt, remaining }
}

export const SLA_RANK: Record<SlaKind, number> = {
  overdue: 0,
  pickup_late: 1,
  soon: 2,
  paused: 3,
  ok: 4,
  not_started: 5,
  pickup: 6,
  stopped: 7,
}
