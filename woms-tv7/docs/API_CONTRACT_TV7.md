# Hợp đồng API của phần TV7 (bản nháp để bàn với TV4, TV5)

Nguồn chuẩn về kiểu dữ liệu là `src/api/contract.ts`. Tài liệu này mô tả đường dẫn, quyền và quy tắc.
Bản `src/api/mockApi.ts` đang hiện thực đúng hợp đồng này bằng dữ liệu giả, nên có thể chạy thử hành vi mong muốn trước khi backend xong.
Mọi nội dung ở đây là **đề xuất**, TV4 và TV1 có thể điều chỉnh. Khi đổi chỉ cần sửa `src/api/httpApi.ts`.

## 1. Nguyên tắc chung

| Chủ đề | Đề xuất |
| --- | --- |
| Thời gian | Epoch mili-giây, UTC. Có thể đổi sang ISO-8601, chỉ cần đổi `httpApi.ts`. |
| Nơi tính SLA | **Server.** Hạn, trạng thái, vi phạm, cảnh báo đều do server tính và lưu, vì cảnh báo phải sinh cả khi không ai mở trang. Giao diện chỉ hiển thị. |
| Lọc dữ liệu cho khách | **Server.** Response của `/portal/*` không được chứa số điện thoại, SLA nội bộ, ghi chú nội bộ, tên kỹ thuật viên. |
| Đăng nhập | Khu vực `/portal/*` công khai, dùng `X-Portal-Session` do `lookup` cấp. Khu vực còn lại cần `Authorization: Bearer`. |
| Lỗi | HTTP 4xx kèm JSON `{ "code": "...", "message": "..." }`. Mã lỗi ở mục 4. |
| Thập phân tiền | Số nguyên đồng (VND), không có phần lẻ. |

## 2. Endpoint

### 2.1 Portal khách hàng (công khai)

| Hàm | Method và đường dẫn | Body | Trả về | Ghi chú |
| --- | --- | --- | --- | --- |
| `lookup` | `POST /portal/lookup` | `{ code, phone, captcha?: { id, answer } }` | 200 `{ session, view }` | Sai mã và sai SĐT đều trả **404 NOT_FOUND**, cùng nội dung. Sai quá 5 lần thì trả **429 CAPTCHA_REQUIRED** kèm `challenge`. Sai đáp án trả **400 CAPTCHA_WRONG** kèm `challenge` mới. **Đếm lần sai ở server** (theo IP hoặc thiết bị), không đếm ở trình duyệt. |
| `openCase` | `GET /portal/cases/:code` | không | `PortalCaseView` | Header `X-Portal-Session`. Phiếu không thuộc SĐT của phiên trả 404, giống phiếu không tồn tại. |
| `requestQuoteOtp` | `POST /portal/cases/:code/quote/otp` | không | `{ sent: true }` | Chỉ khi phiếu `QUOTED` và báo giá đã gửi khách. Gửi OTP qua SMS. Ngoài ra trả 409 INVALID_STATE. |
| `respondQuote` | `POST /portal/cases/:code/quote/respond` | `{ accept, otp? }` | `PortalCaseView` | Đồng ý bắt buộc có OTP (sai trả 400 INVALID_OTP). Từ chối không cần OTP. |

`PortalCaseView` gồm: `case` (thông tin công khai và `closed`), `eta`, `history` (lịch sử đúng thiết bị, chỉ phiếu của cùng SĐT), `otherDevices`, `notifications`.
Báo giá chỉ xuất hiện trong `case.quote` khi đã gửi cho khách. Báo giá còn chờ quản lý duyệt thì `quote = null`.

### 2.2 SLA, cảnh báo, Dashboard (nội bộ)

| Hàm | Method và đường dẫn | Quyền đề xuất | Ghi chú |
| --- | --- | --- | --- |
| `listSla` | `GET /sla/cases` | Mọi nhân viên đã đăng nhập (TV6 dùng để hiện nhãn trên danh sách phiếu) | Mỗi phiếu một dòng: mốc SLA đang chạy, hạn, còn lại, trạng thái. |
| `pauseSla` | `POST /sla/cases/:code/pause` | Điều phối viên, quản lý | Body `{ kind? }`. **Thông thường do chuyển trạng thái phiếu tự kích hoạt**, endpoint này để điều chỉnh thủ công. |
| `resumeSla` | `POST /sla/cases/:code/resume` | Như trên | |
| `finishSla` | `POST /sla/cases/:code/finish` | Như trên | |
| `getSlaHistory` | `GET /sla/cases/:code/history` | Mọi nhân viên | |
| `getSettings` | `GET /sla/settings` | Mọi nhân viên | Chính sách SLA, ngưỡng cảnh báo, lịch làm việc. |
| `updateSettings` | `PUT /sla/settings` | Quản lý | Body `SlaSettingsPatch`. Dữ liệu sai trả 400 VALIDATION. |
| `calculateDeadline` | `POST /sla/deadline` | Mọi nhân viên | Body `{ start, hours }`, trả `{ deadline }`. |
| `listAlerts` | `GET /sla/alerts` | Điều phối viên, quản lý, CSKH | Mỗi cảnh báo kèm `commands` (thao tác được phép, do server quyết định). |
| `actOnAlert` | `POST /sla/alerts/:id/actions` | Theo lệnh, xem dưới | Body `{ command }`. `id` có dấu hai chấm nên phải mã hóa URL. |
| `getDashboard` | `GET /dashboard` | Nhân viên đã đăng nhập, nội dung theo vai trò (xem mục 5) | |
| `approveQuote` | `POST /quotes/:code/approve` | Quản lý | Chỉ báo giá `PENDING_MANAGER`. Duyệt xong báo giá gửi cho khách và SLA-02 tạm dừng chờ phản hồi. |

Lệnh xử lý cảnh báo: `COORDINATOR_DONE` và `ESCALATE` do điều phối viên, `MANAGER_DONE` do quản lý, `CSKH_DONE` do CSKH. Lệnh không hợp lệ ở trạng thái hiện tại trả 409.

## 3. Quy tắc nghiệp vụ server cần thực hiện

| Quy tắc | Căn cứ |
| --- | --- |
| Báo giá lớn hơn 2.000.000 đồng phải được quản lý duyệt trước khi gửi khách (đúng bằng ngưỡng thì không cần) | BR-07, PARAM-03 |
| Tạm dừng có trần: chờ linh kiện 3 ngày làm việc, xác nhận lại báo giá 5 ngày. Phần vượt trần tính vào thời gian xử lý | BR-26, PARAM-16, 17 |
| Sau 3 ngày làm việc chờ linh kiện: cảnh báo điều phối viên và quản lý | PARAM-15 |
| Báo giá không phản hồi: nhắc khách sau 2 và 4 ngày làm việc, sau 5 ngày báo CSKH, không tự coi là từ chối | PARAM-04, 18 |
| Sinh và lưu cảnh báo bằng tác vụ chạy định kỳ ở server | BR-25, FR-14 |
| Bảo hành sau sửa chữa 6 tháng kể từ ngày bàn giao | PARAM-01 |

Phần thuật toán đã có sẵn và có test trong `src/sla/` và `src/services/`, có thể chép sang NestJS.

## 4. Mã lỗi

| Mã | HTTP đề xuất | Ý nghĩa |
| --- | --- | --- |
| `NOT_FOUND` | 404 | Không tìm thấy (kể cả phiếu của người khác) |
| `FORBIDDEN` | 403 | Phiên hoặc quyền không hợp lệ |
| `INVALID_STATE` | 409 | Thao tác không áp dụng ở trạng thái hiện tại |
| `INVALID_OTP` | 400 | OTP sai |
| `VALIDATION` | 400 | Dữ liệu đầu vào sai |
| `CAPTCHA_REQUIRED` | 429 | Cần trả lời CAPTCHA, kèm `challenge` |
| `CAPTCHA_WRONG` | 400 | Đáp án sai, kèm `challenge` mới |
| `INTERNAL` | 500 | Lỗi hệ thống |

## 5. Câu hỏi cần chốt

**Với TV4**
1. Chấp nhận mô hình "server tính SLA" không? Nếu không, giao diện sẽ phải tự tính và cảnh báo chỉ hiện khi có người mở trang.
2. Tác vụ định kỳ sinh cảnh báo đặt ở đâu (cron trong NestJS hay hàng đợi)?
3. Thời gian dùng epoch mili-giây hay ISO-8601?

**Với TV5**
4. Danh sách trạng thái nội bộ và sự kiện đổi trạng thái kèm thời điểm. Cần bảng: chuyển sang trạng thái nào thì tạo, tạm dừng, tiếp tục hoặc đóng SLA nào (ví dụ vào `WAITING_PARTS` thì tạm dừng SLA-03).
5. Có lưu serial thiết bị trong Case không? Lịch sử theo thiết bị (FR-17) cần trường này.
6. Báo giá lưu ở đâu: cần tách `parts`, `labor`, `status`, `sentAt`.

**Với TV1 và TV6**
7. Màn hình lập báo giá (CSKH), duyệt báo giá và xử lý cảnh báo (điều phối viên, quản lý) thuộc ai? Hiện đang nằm trong trang SLA và Dashboard của TV7.
8. Dashboard: vai trò nào được xem gì (ma trận phân quyền 5.3)?
9. Portal và giao diện nội bộ dùng chung một ứng dụng hay hai?

**Giữa các tài liệu (cần TV2, TV3 chốt)**
10. Ngưỡng cảnh báo: 75% thời hạn (SRS FR-14) hay còn 4 giờ làm việc (PARAM-09).
11. Mốc SLA: 4 mốc (SRS B.6) hay một mốc 3 ngày làm việc (PARAM-08), và một ngày làm việc là bao nhiêu giờ.
12. Nhãn 5 bước hiển thị cho khách: theo SRS UC-16 hay theo file phân công TV7.
