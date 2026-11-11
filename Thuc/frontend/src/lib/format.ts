// Lưu UTC, hiển thị giờ Việt Nam.
const dt = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export const formatDateTime = (iso: string) => dt.format(new Date(iso))

// GIẢ ĐỊNH: tính theo giờ đồng hồ. SLA thật tính theo giờ làm việc (TV7/TV5).
export function slaState(dueIso: string, paused?: boolean) {
  if (paused) return { kind: 'paused' as const, text: 'SLA tạm dừng' }
  const hours = (new Date(dueIso).getTime() - Date.now()) / 3_600_000
  const fmt = (x: number) => (x >= 24 ? `${Math.round(x / 24)} ngày` : `${Math.max(1, Math.round(x))} giờ`)
  if (hours < 0) return { kind: 'overdue' as const, text: `Quá hạn ${fmt(-hours)}` }
  // GIẢ ĐỊNH: còn dưới 4 giờ là sắp quá hạn (chờ TV7 chốt ngưỡng).
  if (hours < 4) return { kind: 'soon' as const, text: `Còn ${fmt(hours)}` }
  return { kind: 'ok' as const, text: `Còn ${fmt(hours)}` }
}
