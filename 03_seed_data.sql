-- 1. Insert Roles (Mục 1)
INSERT INTO oltp.roles (role_name, description) VALUES
('Admin', 'Quản trị viên hệ thống'),
('Coordinator', 'Điều phối viên'),
('Technician', 'Kỹ thuật viên'),
('Inspector', 'Nhân viên kiểm định');

-- 2. Insert Users
INSERT INTO oltp.users (full_name, role_name) VALUES
('Nguyen Van Admin', 'Admin'),
('Tran Thi Coordinator', 'Coordinator'),
('Le Van Tech', 'Technician'),
('Pham Thi Tech', 'Technician'),
('Hoang Van Inspector', 'Inspector');

-- 3. Insert User Roles
INSERT INTO oltp.user_roles (user_id, role_id) VALUES 
(1, 1), (2, 2), (3, 3), (4, 3), (5, 4);

-- 4. Insert Customers & Devices
INSERT INTO oltp.customers (full_name, phone, email, address) VALUES
('Khach Hang A', '0901234567', 'a@gmail.com', 'Hanoi'),
('Khach Hang B', '0909876543', 'b@gmail.com', 'HCM');

INSERT INTO oltp.devices (customer_id, serial_number, brand, model, warranty_expiry) VALUES
(1, 'SN-IPHONE-01', 'Apple', 'iPhone 14 Pro', '2024-12-31'),
(2, 'SN-SAMSUNG-01', 'Samsung', 'Galaxy S23', '2024-10-15'),
(1, 'SN-DELL-01', 'Dell', 'XPS 15', '2025-01-01');

-- 5. Insert Warranty Cases (Tạo ra các ca ở nhiều trạng thái khác nhau để test Workflow)
INSERT INTO oltp.warranty_cases (device_id, created_by, issue_description, priority, service_type, status) VALUES
(1, 2, 'Màn hình bị sọc xanh', 'High', 'Hardware', 'New'),
(2, 2, 'Pin tụt nhanh, nóng máy', 'Medium', 'Hardware', 'Assigned'),
(3, 2, 'Lỗi win, không lên nguồn', 'Low', 'Software', 'In_Progress');

-- 6. Insert Work Orders (Phân công cho KTV)
INSERT INTO oltp.work_orders (case_id, assigned_to, status, start_time) VALUES
(2, 3, 'Assigned', CURRENT_TIMESTAMP),
(3, 4, 'In_Progress', CURRENT_TIMESTAMP);

-- 7. Insert SLA Policies (Mục 6)
INSERT INTO oltp.sla_policies (service_type, time_limit, unit) VALUES
('Hardware', 48, 'hours'),
('Software', 24, 'hours');