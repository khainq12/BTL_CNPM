import { afterEach, describe, expect, it } from 'vitest'
import { fmtDateTime } from '../src/format'
import { PARAMS, WORK_DAY_MINUTES } from '../src/params'
import { addWorkingMinutes, setHolidays, slaInfo, workingMinutesBetween } from '../src/sla'
import type { WarrantyCase } from '../src/types'

// SLA theo giờ làm việc (NFR-04: 08:00–17:30, Thứ 2 – Thứ 7, trừ ngày lễ; PARAM-08/09/16/17). Mốc giờ viết theo giờ VN (UTC+7).
const vn = (s: string) => Date.parse(`${s}+07:00`)
const iso = (s: string) => new Date(vn(s)).toISOString()
const H = 60

const kase = (over: Partial<WarrantyCase> = {}): WarrantyCase =>
  ({
    id: 'k',
    code: 'CAS-TEST',
    version: 1,
    status: 'IN_REPAIR',
    customerId: 'c',
    deviceId: 'd',
    channel: 'QUAY',
    symptom: '',
    condition: '',
    accessories: [],
    noAccessories: true,
    photos: [],
    createdAt: iso('2026-11-23T08:00:00'),
    quotes: [],
    reworkCount: 0,
    qc: [],
    sla: { planConfirmedAt: iso('2026-11-23T08:00:00'), pauses: [] },
    events: [],
    ...over,
  }) as WarrantyCase

afterEach(() => setHolidays([]))

describe('Lịch làm việc', () => {
  it('TC-036 | cộng 16 giờ làm việc từ 08:00 Thứ Hai → 14:30 Thứ Ba (ngày làm việc 9,5 giờ)', () => {
    expect(addWorkingMinutes(vn('2026-11-23T08:00:00'), 16 * H)).toBe(vn('2026-11-24T14:30:00'))
    expect(workingMinutesBetween(vn('2026-11-23T08:00:00'), vn('2026-11-24T14:30:00'))).toBe(16 * H)
  })

  it('TC-040 | qua Chủ nhật và ngày lễ không tính giờ', () => {
    expect(addWorkingMinutes(vn('2026-11-28T16:30:00'), 2 * H)).toBe(vn('2026-11-30T09:00:00'))
    setHolidays(['2026-11-30'])
    expect(addWorkingMinutes(vn('2026-11-28T16:30:00'), 2 * H)).toBe(vn('2026-12-01T09:00:00'))
    expect(workingMinutesBetween(vn('2026-11-29T00:00:00'), vn('2026-11-29T23:59:00'))).toBe(0)
  })

  it('ngoài giờ làm việc thì bắt đầu tính từ 08:00 ngày làm việc kế tiếp', () => {
    expect(addWorkingMinutes(vn('2026-11-23T19:00:00'), 30)).toBe(vn('2026-11-24T08:30:00'))
    expect(addWorkingMinutes(vn('2026-11-23T06:00:00'), 30)).toBe(vn('2026-11-23T08:30:00'))
  })

  it('TC-041 | lưu UTC, hiển thị giờ Việt Nam', () => {
    expect(fmtDateTime('2026-11-23T01:05:00.000Z')).toBe('23/11/2026 08:05')
  })
})

describe('Hạn xử lý 3 ngày làm việc (PARAM-08)', () => {
  const due = vn('2026-11-25T17:30:00')

  it('TC-035 | chưa xác nhận phương án thì chưa tính hạn', () => {
    expect(slaInfo(kase({ sla: { pauses: [] } }), vn('2026-11-23T09:00:00')).kind).toBe('not_started')
  })

  it('còn hạn: hạn bằng 3 ngày làm việc kể từ lúc xác nhận phương án', () => {
    const s = slaInfo(kase(), vn('2026-11-23T09:00:00'))
    expect(s.kind).toBe('ok')
    expect(Date.parse(s.dueAt!)).toBe(due)
    expect(s.remaining).toBe(3 * WORK_DAY_MINUTES - 60)
  })

  it('TC-039 | còn ≤ 4 giờ làm việc thì cảnh báo sắp quá hạn; quá hạn thì báo quá hạn', () => {
    expect(slaInfo(kase(), vn('2026-11-25T13:30:00')).kind).toBe('soon')
    expect(slaInfo(kase(), vn('2026-11-25T13:29:00')).kind).toBe('ok')
    const late = slaInfo(kase(), vn('2026-11-26T10:00:00'))
    expect(late.kind).toBe('overdue')
    expect(late.remaining).toBe(-2 * H)
    expect(PARAMS.warnBeforeMinutes).toBe(4 * H)
  })

  it('TC-037 TC-038 | tạm dừng khi chờ linh kiện; tiếp tục sau khi có hàng, hạn dời đúng bằng thời gian dừng', () => {
    const open = [{ reason: 'CHO_LINH_KIEN' as const, start: iso('2026-11-24T08:00:00') }]
    expect(slaInfo(kase({ sla: { planConfirmedAt: iso('2026-11-23T08:00:00'), pauses: open } }), vn('2026-11-24T12:00:00')).kind).toBe('paused')
    const ended = [{ ...open[0], end: iso('2026-11-24T12:00:00') }]
    const s = slaInfo(kase({ sla: { planConfirmedAt: iso('2026-11-23T08:00:00'), pauses: ended } }), vn('2026-11-24T13:00:00'))
    expect(s.kind).toBe('ok')
    expect(Date.parse(s.dueAt!)).toBe(addWorkingMinutes(due, 4 * H))
  })

  it('PARAM-17 | chờ linh kiện quá 3 ngày làm việc thì phần vượt vẫn tính vào hạn', () => {
    const open = [{ reason: 'CHO_LINH_KIEN' as const, start: iso('2026-11-23T08:00:00') }]
    expect(slaInfo(kase({ sla: { planConfirmedAt: iso('2026-11-23T08:00:00'), pauses: open } }), vn('2026-12-03T08:00:00')).kind).toBe('overdue')
  })

  it('tạm dừng bắt đầu sau khi đã quá hạn không xóa vi phạm', () => {
    const open = [{ reason: 'CHO_XAC_NHAN_GIA' as const, start: iso('2026-11-26T09:00:00') }]
    expect(slaInfo(kase({ sla: { planConfirmedAt: iso('2026-11-23T08:00:00'), pauses: open } }), vn('2026-11-26T10:00:00')).kind).toBe('overdue')
  })

  it('PARAM-05 | sẵn sàng bàn giao quá 30 ngày thì cảnh báo lưu giữ', () => {
    const readyAt = iso('2026-10-01T09:00:00')
    expect(slaInfo(kase({ status: 'READY_FOR_DELIVERY', readyAt }), vn('2026-11-23T09:00:00')).kind).toBe('pickup_late')
    expect(slaInfo(kase({ status: 'READY_FOR_DELIVERY', readyAt }), vn('2026-10-20T09:00:00')).kind).toBe('pickup')
  })
})
