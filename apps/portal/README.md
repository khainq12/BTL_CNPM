# WOMS – Phần TV7: Customer Portal, SLA, Dashboard cơ bản

Vite + React + TypeScript. Dữ liệu là giả lập trong bộ nhớ, chưa nối API thật.

## Chạy

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit test (vitest) cho bộ tính SLA và portal service
npm run build      # kiểm tra kiểu rồi build
```

## Cấu trúc

| Đường dẫn | Nội dung |
| --- | --- |
| `src/sla/calendar.ts` | Lịch làm việc, cộng/trừ giờ làm việc (TV7-08) |
| `src/sla/engine.ts` | Đánh giá SLA, cảnh báo, vi phạm, lịch sử, thống kê Dashboard (TV7-09…12) |
| `src/services/portalService.ts` | Tra cứu, dữ liệu công khai, thông báo, phản hồi báo giá (TV7-01…06) |
| `src/constants.ts` | Lịch mặc định, 4 mốc SLA, ánh xạ trạng thái nội bộ sang 5 bước hiển thị cho khách |
| `src/data/seed.ts` | Dữ liệu mẫu giả lập |
| `src/store.tsx` | Trạng thái toàn cục (React Context) |
| `src/pages/` | `PortalPage`, `SlaPage`, `DashboardPage` |
| `src/**/*.test.ts` | Unit test, gồm các ca ở mục 3 của file phân công TV7 |

`src/sla/` và `src/services/` không phụ thuộc React, có thể chuyển nguyên sang NestJS service của TV4.

## Giả định (chưa xác nhận thực địa)

- Lịch mặc định theo SRS NFR-04: 08:00–17:30, Thứ Hai đến Thứ Bảy, không nghỉ trưa. Lịch của hồ sơ khảo sát v0.2 (08:00–17:00, nghỉ trưa, Thứ Hai đến Thứ Sáu) được dùng trong test.
- Bốn mốc SLA theo SRS mục B.6: 2, 4, 24, 8 giờ làm việc.
- Cảnh báo ở 75% (FR-14). Đúng bằng hạn vẫn tính là đúng hạn; quá hạn khi vượt 100%.
- Giờ tính theo múi giờ của trình duyệt. Khi làm backend cần lưu UTC và quy đổi theo múi giờ trung tâm.
- OTP xác nhận báo giá là `000000` (chỉ cho bản mẫu).
- Mã phiếu dùng định dạng SRS `CAS-YYYYMMDD-XXXX`, luôn kèm số điện thoại khi tra cứu.

## Câu hỏi cần chốt với nhóm

- Có cần chiều "loại dịch vụ" hoặc mức ưu tiên cho chính sách SLA không (file phân công ghi "theo loại dịch vụ", SRS chỉ có 4 mốc)?
- Dashboard "kỳ" là theo ngày, tuần hay tháng? Bản này tính trên toàn bộ phiếu.
- Điều kiện để một phiếu tính là "chờ khách hàng" (hiện gồm chờ báo giá và chờ nhận máy).

## Ghi chú AUR

Mã nguồn có AI hỗ trợ: ghi vào Phụ lục Z, review qua Pull Request (TV6 review mã, TV2 và TV9 review nghiệp vụ SLA) theo AUR.04 và AUR.99.
