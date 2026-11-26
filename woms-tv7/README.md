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
| `src/sla/engine.ts` | Đánh giá SLA, trần tạm dừng, lịch sử, thống kê Dashboard (TV7-09…12) |
| `src/sla/alerts.ts` | Nhật ký cảnh báo và leo thang (BR-25, FR-14) |
| `src/services/portalService.ts` | Tra cứu, dữ liệu công khai, thông báo, lịch sử theo thiết bị (TV7-01…06) |
| `src/services/quoteService.ts` | Báo giá: ngưỡng duyệt, gửi khách, nhắc nhở |
| `src/constants.ts` | Lịch mặc định, 4 mốc SLA, ánh xạ trạng thái nội bộ sang 5 bước hiển thị cho khách |
| `src/data/seed.ts` | Dữ liệu mẫu giả lập |
| `src/api/` | **Lớp API**: `contract.ts` (hợp đồng), `mockApi.ts` (server giả), `httpApi.ts` (gọi backend thật), `index.ts` (chọn bản) |
| `src/sla/actions.ts` | Tạm dừng, tiếp tục, hoàn tất SLA (hàm thuần) |
| `src/AppState.tsx`, `src/hooks.ts` | Làm mới dữ liệu và tải bất đồng bộ cho giao diện |
| `src/pages/` | `PortalPage`, `SlaPage`, `DashboardPage` |
| `src/**/*.test.ts` | Unit test, gồm các ca ở mục 3 của file phân công TV7 và test qua lớp API |
| `docs/API_CONTRACT_TV7.md` | Bản nháp hợp đồng API để bàn với TV4, TV5 |

`src/sla/` và `src/services/` không phụ thuộc React, có thể chuyển nguyên sang NestJS service của TV4.

## Lớp API và cách nối backend

Giao diện **không gọi thẳng logic**, chỉ gọi các hàm trong `src/api/contract.ts` qua `import { api } from './api'`.

- Mặc định `api` là `mockApi` (dữ liệu giả, mô phỏng một server: lọc dữ liệu cho khách, đếm lần tra cứu sai, kiểm tra quyền thao tác, tính SLA).
- Khi backend sẵn sàng, tạo file `.env.local` với dòng `VITE_API_BASE_URL=http://localhost:3000/api`. Lúc đó `api` là `httpApi`.
- Nếu backend chốt đường dẫn hoặc định dạng khác, chỉ cần sửa `src/api/httpApi.ts`.
- “Giờ hệ thống mẫu” và nút xem khi 0 phiếu chỉ có ở bản mock (`api.dev`), bản HTTP dùng giờ thật.
- Mô hình đề xuất: **server tính SLA**. Chi tiết endpoint, quyền, mã lỗi và câu hỏi cần chốt ở `docs/API_CONTRACT_TV7.md`.

## Cập nhật theo Tài liệu nghiệp vụ mới

| Nội dung | Căn cứ | Chỗ trong code |
| --- | --- | --- |
| Trần tạm dừng: chờ linh kiện tối đa 3 ngày làm việc, xác nhận lại báo giá tối đa 5 ngày. Phần vượt trần tính vào thời gian xử lý | BR-26, PARAM-16, PARAM-17 | `PAUSE_CAP_DAYS` trong `constants.ts`, `engine.ts` |
| Báo giá có chi tiết linh kiện, tiền công, tổng. Trên 2.000.000 đồng chờ quản lý duyệt, khách chưa thấy. Nhắc khách sau 2 và 4 ngày làm việc, sau 5 ngày báo CSKH | BR-07, StRS-03, PARAM-03, 04, 18 | `quoteService.ts`, `alerts.ts` |
| Nhật ký cảnh báo (người nhận, trạng thái, kết quả xử lý), điều phối viên xử lý hoặc chuyển quản lý | BR-25, PARAM-15, RACI 5.4, RTM FR-14 | `alerts.ts`, tab Theo dõi SLA |
| Lịch sử theo thiết bị (serial), hiện linh kiện đã thay và hạn bảo hành sau sửa chữa 6 tháng | FR-17, BR-29, StRS-04, PARAM-01 | `deviceHistory` trong `portalService.ts` |

Chưa làm (chờ nhóm chốt mâu thuẫn giữa các tài liệu): ngưỡng cảnh báo 75% (SRS) hay còn 4 giờ (PARAM-09), mốc SLA 4 mốc (SRS) hay 3 ngày làm việc (PARAM-08), nhãn 5 bước hiển thị cho khách, và vai trò điều phối viên trong SRS.

## Giả định (chưa xác nhận thực địa)

- “Ngày làm việc” trong các PARAM đổi sang phút bằng độ dài một ngày của lịch (lịch mặc định 9,5 giờ). Nếu nhóm quy ước khác (ví dụ 8 giờ) thì chỉ cần đổi lịch.

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
