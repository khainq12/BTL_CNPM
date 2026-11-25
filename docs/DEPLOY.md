# Triển khai WOMS

## Docker Compose (một máy chủ)

```bash
cp .env.example .env          # đặt JWT_SECRET (>= 32 ký tự ngẫu nhiên), POSTGRES_PASSWORD
docker compose up -d --build  # hoặc: docker compose pull && docker compose up -d   (dùng image từ GHCR do CD đẩy lên)
docker compose --profile demo run --rm seed   # chỉ khi muốn nạp dữ liệu mẫu để demo
```

| Dịch vụ | Cổng | Ghi chú |
| --- | --- | --- |
| `db` | (nội bộ) | PostgreSQL 17, dữ liệu ở volume `pgdata` |
| `api` | 3000 | Tự chạy `prisma migrate deploy` khi khởi động. Healthcheck `GET /api/v1/health/ready` |
| `staff-web` | 8080 | nginx (không chạy root), SPA fallback |
| `portal` | 8081 | như trên |

`VITE_API_URL` được gắn vào bản build của frontend. Khi đổi tên miền API thì build lại image frontend với `--build-arg VITE_API_URL=...`.

## Biến môi trường của API

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `DATABASE_URL` | (bắt buộc) | Chuỗi kết nối PostgreSQL; thêm `?connection_limit=10` để chỉnh pool |
| `JWT_SECRET` | (bắt buộc ở production) | Khóa ký JWT |
| `JWT_TTL_HOURS` | 8 | Hạn phiên (một ca làm việc) |
| `CORS_ORIGINS` | localhost | Tên miền frontend được gọi API, ngăn cách bằng dấu phẩy |
| `OUTBOX_POLL_MS` / `SLA_SCAN_MS` | 2000 / 300000 | Chu kỳ tiến trình nền; 0 để tắt |
| `PORTAL_DEMO_OTP` | 000000 | OTP xác nhận báo giá (thay bằng SMS thật khi có nhà cung cấp) |
| `DEFAULT_PASSWORD` | Woms@2026 | Mật khẩu khi quản lý tạo/đặt lại tài khoản |

## Phát hành

1. Mở Pull Request từ `integration` vào `main`. CI phải xanh.
2. Merge vào `main`. Workflow CD đẩy image lên `ghcr.io/khainq12/woms-*:main`.
3. Gắn tag phiên bản, ví dụ `git tag v0.3.0 && git push origin v0.3.0`. CD tạo GitHub Release, đính kèm báo cáo kiểm thử và OpenAPI.
4. Trên máy chủ: `TAG=0.3.0 docker compose pull && docker compose up -d`.
