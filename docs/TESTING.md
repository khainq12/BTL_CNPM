# Chiến lược kiểm thử WOMS

## 1. Kim tự tháp kiểm thử

Theo The Practical Test Pyramid (Fowler):
- nhiều test nhỏ, nhanh ở tầng dưới;
- ít test qua giao diện ở tầng trên;
- mỗi tầng kiểm thứ tầng dưới không kiểm được.

| Tầng | Công cụ | Kiểm cái gì | Chạy ở |
| --- | --- | --- | --- |
| Unit nghiệp vụ (67) | Vitest | Từng quy tắc BR/C/PARAM trên lệnh thật của `packages/domain`: bắt buộc nhập, ngưỡng duyệt, D1–D10, kho, QC, sửa lại, đổi phương án, SLA giờ làm việc, phân quyền xem, dữ liệu công khai | `packages/domain/test` |
| Component (44) | Vitest browser + Playwright | Thành phần giao diện của TV6 | `apps/staff-web/src/**/*.test.tsx` |
| Unit portal (29) | Vitest | Bản mẫu TV7 (giữ để không mất kiểm thử cũ) | `apps/portal/src/legacy-tv7` |
| Tích hợp API (37) | Vitest + Supertest, PostgreSQL thật | JWT, RBAC 403, 409 version, chống gửi trùng, chạy song song, outbox, portal, kiểm tra đầu vào, chống ghi đè trường hệ thống, giới hạn đăng nhập 429. Chạy trên **bản build** (`dist/`) như khi triển khai | `apps/api/test` |
| E2E (27) | Playwright | Kịch bản người dùng trên trình duyệt thật nối API + PostgreSQL: đăng nhập, menu theo vai trò, tạo phiếu có ảnh, kiểm tra sơ bộ, QC, bàn giao, xung đột hai người, bảng điều hành, cổng khách hàng (máy tính và điện thoại), khách đồng ý báo giá bằng OTP | `e2e/tests` |

## 2. Truy vết với bộ 58 test case của QA

- **Quy ước:** tên test bắt đầu bằng mã TC trong `docs/qa/WOMS_QA_Test_Cases.xlsx`, ví dụ `TC-021 TC-050 | hai lệnh cùng giữ linh kiện cuối cùng...`. Test kiểm quy tắc không có TC riêng thì ghi mã quy tắc (`BR-07`, `PARAM-10`, `C03`, `UC-16`, `MAN-L02`).
- **Ghép kết quả:** `npm run report` đọc kết quả JUnit của mọi tầng và đối chiếu từng TC, theo chuỗi Yêu cầu → Test case → Lần chạy → Kết quả.
  - TC **PASS** khi mọi test gắn mã đó đều đạt.
  - TC **FAIL** khi có test lỗi.
  - TC **chưa tự động** khi chưa có test nào gắn mã đó.
- **Đầu ra:**
  - `reports/test-report.html` và `reports/test-report.md` (ma trận + độ phủ theo FR);
  - `reports/WOMS_QA_Ket_qua_tu_dong.xlsx`: file của QA thêm sheet `Auto_<ngày>`, các sheet cũ giữ nguyên;
  - trên CI: tóm tắt nằm ở Summary của mỗi lần chạy, các file trên ở artifact `test-report`.

Kết quả 25/11/2026: **204/204 test đạt; 53/58 TC có test tự động và đều đạt.**

5 TC chưa tự động vì chưa có chức năng tương ứng trong tài liệu hợp nhất 12/11. Cần nghiệp vụ chốt trước khi làm:

| TC | Nội dung | Lý do |
| --- | --- | --- |
| TC-004 | Serial không hợp lệ/không tìm thấy | Chưa có danh mục serial của hãng để đối chiếu |
| TC-013 | Sửa quyết định đã duyệt | Chưa có quy tắc sửa/thu hồi quyết định (BR-10) |
| TC-028 | Sửa kết luận chẩn đoán sau khi phát hiện sai | Hiện chỉ có đổi phương án khi đang sửa (BR-12) |
| TC-042 | Đổi mức ưu tiên khi SLA đang chạy | Tài liệu hợp nhất không có mức ưu tiên |
| TC-053 | Người không có quyền truy cập ảnh/chứng từ | Chưa có kho tệp riêng (ảnh nằm trong dữ liệu phiếu) |

Các lỗi QA-DEF-001..004 Hoài báo trên bản mock đã có test hồi quy (TC-002, TC-005, TC-029) ở cả tầng nghiệp vụ và API.

## 3. Chạy trên máy

```bash
npm run db:local                       # PostgreSQL cục bộ (cổng 5433, CSDL woms, woms_test, woms_e2e)
npm run build:domain
npm run test -w @woms/domain
npm run test:api                       # DATABASE_URL mặc định trỏ woms_test, tự migrate
npm run test:e2e                       # tự build và bật API :3100, staff-web :4173, portal :4174 (woms_e2e bị nạp lại dữ liệu mẫu)
CI=1 npm run test -w @woms/domain      # CI=1 để ghi JUnit vào reports/junit rồi: npm run report
npx playwright show-report reports/playwright
```

Kiểm thử từ chối chạy trên CSDL không có chữ "test"/"ci" trong tên, để tránh xóa nhầm dữ liệu.

## 4. Thực hành áp dụng và nguồn tham khảo

| Thực hành | Áp dụng ở WOMS | Nguồn |
| --- | --- | --- |
| Kim tự tháp kiểm thử, nhiều test tầng thấp | 67 unit / 37 API / 27 E2E | [The Practical Test Pyramid – Martin Fowler](https://martinfowler.com/articles/practical-test-pyramid.html) |
| PostgreSQL làm service container trong GitHub Actions, healthcheck `pg_isready` | job `api`, `e2e` | [GitHub Docs – Creating PostgreSQL service containers](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers) |
| Kiểm thử e2e NestJS bằng Supertest trên toàn bộ AppModule | `apps/api/test` (dùng bản build) | [NestJS – Testing](https://docs.nestjs.com/fundamentals/testing) |
| Playwright: trace/video khi lỗi, retry chỉ trên CI, `forbidOnly`, báo cáo HTML + JUnit, Page Object | `e2e/playwright.config.ts`, `e2e/support/pages.ts` | [Playwright – Best Practices](https://playwright.dev/docs/best-practices), [Playwright – CI](https://playwright.dev/docs/ci) |
| Transactional Outbox (ghi sự kiện cùng transaction, tiến trình nền đọc, xử lý lặp an toàn) | `state-store.ts`, `outbox.worker.ts` | [microservices.io – Transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html), [AWS Prescriptive Guidance – Transactional outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html) |
| Ma trận truy vết yêu cầu ↔ test ↔ kết quả | `scripts/test-report.mjs` | ISTQB CTFL (sản phẩm kiểm thử, truy vết giữa cơ sở kiểm thử và testware) |
