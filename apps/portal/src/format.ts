const dt = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', hour12: false })

// Lưu UTC, hiển thị giờ Việt Nam (TC-041).
export function formatTime(iso?: string) {
  if (!iso) return '—'
  const p = Object.fromEntries(dt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  return `${p.hour}:${p.minute} ${p.day}/${p.month}/${p.year}`
}

export const formatMoney = (n: number) => `${n.toLocaleString('vi-VN')} ₫`
