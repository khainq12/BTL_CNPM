---

##  Quy trình Trạng thái (Workflow State Machine)

Dưới đây là sơ đồ luồng đi của một ca bảo hành (`warranty_cases`). Hệ thống Database đã được cài đặt Trigger để chặn hành vi cố tình chuyển trạng thái sai quy định.

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

