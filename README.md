HEAD
# WOMS Database - Tài liệu Thiết kế (Data Dictionary)

 File này giải thích chi tiết cấu trúc các bảng, ý nghĩa các cột và các giá trị hợp lệ (Enum) để Backend, Frontend và QA làm việc thống nhất.

## 1. Từ điển dữ liệu (Data Dictionary)

### Bảng: `warranty_cases` (Ca bảo hành)
Lưu trữ thông tin chung nhất về một yêu cầu bảo hành/sửa chữa của khách hàng.

| Tên Cột | Kiểu Dữ Liệu | Ràng Buộc | Mô Tả / Giá trị hợp lệ |
| :--- | :--- | :--- | :--- |
| `case_id` | SERIAL | PK | ID tự tăng của ca bảo hành |
| `device_id` | INT | FK | Trỏ tới bảng `devices` |
| `created_by` | INT | FK | Trỏ tới bảng `users` (người tạo ca) |
| `issue_description` | TEXT | | Mô tả lỗi khách hàng phản ánh |
| `priority` | VARCHAR | | Độ ưu tiên. Gồm các giá trị: `Low`, `Medium`, `High`, `Urgent` |
| `service_type` | VARCHAR | | Loại dịch vụ: `Hardware`, `Software`, `Others` |
| `status` | VARCHAR | | Trạng thái hiện tại. Xem chi tiết ở **Sơ đồ trạng thái** bên dưới. |
| `created_at` | TIMESTAMP | | Thời điểm tạo ca |

### Bảng: `devices` (Thiết bị)
Lưu trữ thông tin thiết bị của khách hàng.

| Tên Cột | Kiểu Dữ Liệu | Ràng Buộc | Mô Tả / Giá trị hợp lệ |
| :--- | :--- | :--- | :--- |
| `device_id` | SERIAL | PK | ID thiết bị |
| `customer_id` | INT | FK | Trỏ tới bảng `customers` |
| `serial_number` | VARCHAR | UNIQUE | Số Serial (IMEI/Mã máy) |
| `brand` | VARCHAR | | Hãng sản xuất (Apple, Samsung...) |
| `model` | VARCHAR | | Dòng máy |
| `warranty_expiry` | DATE | | Ngày hết hạn bảo hành |

*(Lưu ý: Bạn hãy làm tương tự cho các bảng quan trọng khác như `users`, `work_orders`, `sla_policies`...)*
---

## 2. Quy trình Trạng thái (Workflow State Machine)

Dưới đây là sơ đồ luồng đi của một ca bảo hành (`warranty_cases`). Hệ thống Database đã được cài đặt Trigger để **chặn đứng** mọi hành vi cố tình chuyển trạng thái sai quy định.

---

##  Quy trình Trạng thái (Workflow State Machine)

Dưới đây là sơ đồ luồng đi của một ca bảo hành (`warranty_cases`). Hệ thống Database đã được cài đặt Trigger để chặn hành vi cố tình chuyển trạng thái sai quy định.
 3a84a90acc7cdd670aea6426e1e227d2bda61a47

```mermaid
stateDiagram-v2
    [*] --> New : Khách hàng mang máy đến / Tạo API
    
    New --> Assigned : Coordinator phân công KTV
    note right of New: Chỉ Role Coordinator mới thấy nút Phân công
    
    Assigned --> In_Progress : KTV bấm "Bắt đầu sửa"
    note right of Assigned: Chỉ Role Technician mới thao tác được
    
    In_Progress --> Pending_Inspection : KTV bấm "Sửa xong"
    
    Pending_Inspection --> Resolved : Inspector đánh giá ĐẠT
    Pending_Inspection --> In_Progress : Inspector đánh giá TRƯỢT (Làm lại)
    
    Resolved --> Closed : Giao máy cho khách & Thanh toán
    Closed --> [*]
 HEAD


 3a84a90acc7cdd670aea6426e1e227d2bda61a47
