const pad = (n: number) => String(n).padStart(2, '0');

export const formatTime = (t: number) => {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};
export const formatDuration = (m: number) => {
  const a = Math.abs(Math.round(m));
  return `${m < 0 ? '-' : ''}${Math.floor(a / 60)}g ${pad(a % 60)}p`;
};
/** Giá trị cho <input type="datetime-local">. */
export const toInputValue = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const minutesToHHMM = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export const hhmmToMinutes = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};
export const formatMoney = (n: number) => `${n.toLocaleString('vi-VN')} ₫`;
export const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
