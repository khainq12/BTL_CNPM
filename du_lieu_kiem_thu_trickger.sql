BEGIN;

-- 1. Xóa dữ liệu cũ và đặt lại bộ đếm ID (RESET IDENTITY)
-- Lưu ý: Lệnh này sẽ xóa toàn bộ dữ liệu trong 2 bảng này
TRUNCATE TABLE oltp.transition_roles, oltp.workflow_transitions RESTART IDENTITY CASCADE;

-- 2. Nạp dữ liệu vào bảng cha (workflow_transitions)
-- Chỉ định rõ transition_id để đảm bảo mapping chính xác
INSERT INTO oltp.workflow_transitions (transition_id, from_status, to_status, condition) VALUES
(1, 'New', 'Assigned', 'Phân công kỹ thuật viên'),
(2, 'Assigned', 'In_Progress', 'KTV bắt đầu sửa chữa'),
(3, 'In_Progress', 'Pending_Inspection', 'KTV sửa xong, chờ kiểm tra'),
(4, 'Pending_Inspection', 'Resolved', 'Kiểm định đạt (Pass)'),
(5, 'Pending_Inspection', 'In_Progress', 'Kiểm định trượt (Fail), sửa lại'),
(6, 'Resolved', 'Closed', 'Đã giao máy cho khách');

-- 3. Nạp dữ liệu vào bảng con (transition_roles)
-- (Giả sử role_id 1 là Admin, 2 là Coordinator, 3 là Technician)
INSERT INTO oltp.transition_roles (transition_id, role_id) VALUES 
(1, 2), -- Coordinator được phân công
(2, 3), (3, 3), -- Technician bắt đầu và sửa xong
(4, 1), (5, 1), -- Admin kiểm định 
(6, 2); -- Coordinator đóng ca

-- Xác nhận giao dịch
COMMIT;