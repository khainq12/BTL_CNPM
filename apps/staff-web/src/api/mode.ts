// Chế độ chạy của frontend nội bộ:
// - VITE_API_URL có giá trị (ví dụ http://localhost:3000): gọi backend NestJS thật (JWT, PostgreSQL).
// - Không đặt: bản chạy thử trong trình duyệt (localStorage), dùng cùng bộ quy tắc nghiệp vụ @woms/domain.
export const API_URL: string | undefined = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || undefined
export const isHttp = !!API_URL
