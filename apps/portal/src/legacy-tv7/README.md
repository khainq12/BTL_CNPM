# Bản mẫu TV7 ban đầu (Tường Anh, 11/11/2026)

Mã gốc của cổng khách hàng + bộ tính SLA + Dashboard chạy trên dữ liệu giả, theo mô hình trạng thái của SRS (mục B.5, 4 mốc SLA mục B.6).

Khi tích hợp (25/11/2026), nhóm chốt theo tài liệu hợp nhất 12/11/2026 (21 trạng thái, SLA 3 ngày làm việc, PARAM-08/09/16/17):

| Phần của TV7 | Nay nằm ở |
| --- | --- |
| Tra cứu bằng mã phiếu + SĐT, không lộ phiếu tồn tại (BR-11), 5 bước công khai | `@woms/domain/public` + `POST /api/v1/public/lookup` + `src/pages/Lookup.tsx` |
| Câu hỏi xác nhận sau 5 lần sai (UC-16) | `src/pages/Lookup.tsx` (client) + giới hạn số lần gọi theo IP ở API |
| Xác nhận báo giá bằng OTP (TV7-06) | `POST /api/v1/public/quote-response` |
| Thông báo cho khách | Outbox worker sinh thông báo (`apps/api/src/outbox`) |
| Dashboard (TV7-10..12) | `@woms/domain/dashboard` + trang "Bảng điều hành" của quản lý (staff-web) + `GET /api/v1/reports/dashboard` |
| Bộ tính SLA theo lịch làm việc | `@woms/domain/sla` (bản của TV6 theo tài liệu hợp nhất) |

Thư mục này giữ lại để đối chiếu và để các unit test cũ (`*.test.ts`) vẫn chạy trong CI. Không được nhúng vào bản build.
