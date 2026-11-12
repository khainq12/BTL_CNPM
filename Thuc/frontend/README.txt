WOMS - STAFF WORKSPACE (FRONTEND NỘI BỘ, TV6)

Giao diện cho nhân viên trung tâm bảo hành: tiếp nhận, CSKH, điều phối, kỹ thuật viên,
kho, kiểm tra chất lượng, quản lý. Dựng trên template shadcn-admin (MIT, xem LICENSE-shadcn-admin.txt).
Công nghệ: React 19, TypeScript, Vite, TanStack Router, TanStack Query, Tailwind, shadcn/ui.


CHẠY THỬ

  npm install
  npm run dev

Mở http://localhost:5173 (cổng mặc định của Vite).


TÀI KHOẢN MẪU (dữ liệu giả, chưa nối backend)

Mật khẩu chung: xem hằng DEMO_PASSWORD trong src/mock/seed.ts

  tiepnhan     Nhân viên tiếp nhận
  cskh         Nhân viên CSKH/bảo hành
  dieuphoi     Điều phối viên
  ktv.an       Kỹ thuật viên
  ktv.binh     Kỹ thuật viên
  ktv.cuong    Kỹ thuật viên
  kho          Nhân viên kho
  qc           Nhân viên kiểm tra chất lượng
  quanly       Quản lý
  tiepnhan2    Tài khoản đã khóa (để thử đăng nhập bị từ chối)

Muốn đổi vai trò: đăng xuất rồi đăng nhập tài khoản khác.
Gợi ý thử luồng đổi phương án (BR-12): đăng nhập ktv.an, mở phiếu CAS-20261106-0041 (đang sửa),
bấm "Đề xuất đổi phương án"; sau đó đăng nhập cskh để xét đề xuất.
Dữ liệu lưu trong localStorage của trình duyệt. Muốn quay về dữ liệu ban đầu: ở trang đăng nhập,
bấm "Khôi phục dữ liệu mẫu".


CẤU TRÚC

  src/domain/      Vai trò, 21 trạng thái và bảng chuyển trạng thái, tham số PARAM, quy tắc D1-D10,
                   tính thời hạn theo giờ làm việc. Sửa ở đây khi nhóm chốt khác.
  src/api/         Lớp gọi API (service.ts) và hook dùng chung (hooks.ts). Thay bằng API thật của TV4.
  src/mock/        Dữ liệu giả và nơi lưu (localStorage).
  src/features/    Các màn hình nghiệp vụ.
  src/routes/      Định tuyến (TanStack Router, tự sinh routeTree.gen.ts).
  SUY_LUAN.txt     Các điểm TV6 tự suy luận khi tài liệu chưa rõ, kèm người cần xác nhận.


MÀN HÌNH

  Hộp việc                    mọi vai trò, nội dung theo vai trò
  Danh sách phiếu, chi tiết   tiếp nhận, CSKH, điều phối, quản lý (KTV, kho, QC chỉ mở phiếu được giao)
  Tạo phiếu tiếp nhận         tiếp nhận
  Yêu cầu trực tuyến          tiếp nhận, quản lý
  Khách hàng, thiết bị        tiếp nhận, CSKH, quản lý
  Bảng điều phối              điều phối, quản lý (xem)
  Việc của tôi                kỹ thuật viên
  Chờ kiểm tra chất lượng     QC
  Chờ bàn giao                tiếp nhận, CSKH
  Kho: yêu cầu, tồn, nhập, kiểm kê, lịch sử
  Phê duyệt                   quản lý
  Khiếu nại                   CSKH, quản lý
  Tài khoản, lịch làm việc,   quản lý
  nhật ký thao tác
