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
