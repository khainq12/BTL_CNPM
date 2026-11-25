const TZ = 'Asia/Ho_Chi_Minh'

const dt = new Intl.DateTimeFormat('vi-VN', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
const d = new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' })
const money = new Intl.NumberFormat('vi-VN')

// Lưu UTC (ISO), hiển thị giờ Việt Nam dạng dd/MM/yyyy HH:mm.
export function fmtDateTime(iso?: string) {
  if (!iso) return '—'
  const p = Object.fromEntries(dt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`
}

export function fmtDate(iso?: string) {
  return iso ? d.format(new Date(iso)) : '—'
}

export function fmtMoney(n: number) {
  return `${money.format(Math.round(n))} đ`
}

export function fmtMinutes(min: number) {
  const m = Math.max(0, Math.round(min))
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h === 0) return `${r} phút`
  return r ? `${h} giờ ${r} phút` : `${h} giờ`
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return (parts.length > 1 ? parts[parts.length - 2][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase()
}

// Thời gian tương đối để dò nhanh ("2 giờ trước"); ngày giờ đầy đủ hiện khi rê chuột.
export function fmtAgo(iso?: string, now = Date.now()) {
  if (!iso) return '—'
  const m = Math.floor((now - Date.parse(iso)) / 60_000)
  if (m < 1) return 'vừa xong'
  if (m < 60) return `${m} phút trước`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} giờ trước`
  const d = Math.floor(h / 24)
  return d < 7 ? `${d} ngày trước` : fmtDateTime(iso)
}

// Ngày và tháng ngắn gọn (21/11), giờ Việt Nam.
export function fmtDayMonth(iso: string) {
  const p = Object.fromEntries(dt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  return `${p.day}/${p.month}`
}
