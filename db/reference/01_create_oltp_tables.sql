-- MỤC 1: NGƯỜI DÙNG & PHÂN QUYỀN
-- =======================================================
-- Bảng roles (Tạo trước vì user_roles cần tham chiếu tới)
CREATE TABLE IF NOT EXISTS oltp.roles (
    role_id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT
);

-- Bảng trung gian user_roles
CREATE TABLE IF NOT EXISTS oltp.user_roles (
    user_id INT REFERENCES oltp.users(user_id) ON DELETE CASCADE,
    role_id INT REFERENCES oltp.roles(role_id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);
-- Bảng Users 
CREATE TABLE oltp.users (
    user_id SERIAL PRIMARY KEY,
    full_name VARCHAR(255),
    role_name VARCHAR(50)
);

-- =======================================================
-- MỤC 2: KHÁCH HÀNG & THIẾT BỊ
-- =======================================================
-- Bảng customers
CREATE TABLE IF NOT EXISTS oltp.customers (
    customer_id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT
);
-- Bảng Devices 
CREATE TABLE oltp.devices (
    device_id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL, -- Khóa ngoại liên kết tới khách hàng
    serial_number VARCHAR(100) UNIQUE, -- Số Serial thường là duy nhất
    brand VARCHAR(100),
    model VARCHAR(100),
    warranty_expiry DATE, -- Ngày hết hạn bảo hành
    
    -- Thiết lập khóa ngoại
    CONSTRAINT fk_device_customer 
        FOREIGN KEY (customer_id) 
        REFERENCES oltp.customers(customer_id) 
        ON DELETE CASCADE -- Nếu xóa khách hàng, xóa luôn thiết bị của họ
);

-- =======================================================
-- MỤC 3: BẢO HÀNH & SỬA CHỮA
-- =======================================================
-- Bảng diagnoses (Chẩn đoán)
CREATE TABLE IF NOT EXISTS oltp.diagnoses (
    diagnosis_id SERIAL PRIMARY KEY,
    case_id INT REFERENCES oltp.warranty_cases(case_id) ON DELETE CASCADE,
    diagnosis_result TEXT,
    root_cause TEXT,
    created_by INT REFERENCES oltp.users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng warranty_decisions (Quyết định bảo hành)
CREATE TABLE IF NOT EXISTS oltp.warranty_decisions (
    decision_id SERIAL PRIMARY KEY,
    case_id INT REFERENCES oltp.warranty_cases(case_id) ON DELETE CASCADE,
    is_warranty BOOLEAN, -- True nếu được bảo hành miễn phí
    decision_reason TEXT,
    decided_by INT REFERENCES oltp.users(user_id),
    decided_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng quotations (Báo giá)
CREATE TABLE IF NOT EXISTS oltp.quotations (
    quotation_id SERIAL PRIMARY KEY,
    case_id INT REFERENCES oltp.warranty_cases(case_id) ON DELETE CASCADE,
    total_amount DECIMAL(12, 2),
    status VARCHAR(50), -- Pending, Approved, Rejected
    approved_at TIMESTAMP
);

-- Bảng work_tasks (Các đầu việc nhỏ trong một Work Order)
CREATE TABLE IF NOT EXISTS oltp.work_tasks (
    task_id SERIAL PRIMARY KEY,
    work_order_id INT REFERENCES oltp.work_orders(work_order_id) ON DELETE CASCADE,
    task_name VARCHAR(255) NOT NULL,
    status VARCHAR(50),
    estimated_time INT -- Thời gian ước tính (phút)
);

-- Bảng task_assignments (Phân công Kỹ thuật viên cho từng Task)
CREATE TABLE IF NOT EXISTS oltp.task_assignments (
    assignment_id SERIAL PRIMARY KEY,
    task_id INT REFERENCES oltp.work_tasks(task_id) ON DELETE CASCADE,
    technician_id INT REFERENCES oltp.users(user_id), -- Giả sử user có role là technician
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Bảng Warranty Cases 
CREATE TABLE oltp.warranty_cases (
    case_id SERIAL PRIMARY KEY,
    device_id INT NOT NULL,     -- Khóa ngoại tới thiết bị
    created_by INT NOT NULL,    -- Khóa ngoại tới người tạo ca (nhân viên)
    issue_description TEXT,     -- Mô tả lỗi
    priority VARCHAR(50),       -- Độ ưu tiên (High, Medium, Low)
    service_type VARCHAR(100),  -- Loại dịch vụ (Hardware, Software...)
    status VARCHAR(50) DEFAULT 'New', -- Trạng thái (Mặc định là Mới)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Thiết lập khóa ngoại
    CONSTRAINT fk_case_device 
        FOREIGN KEY (device_id) 
        REFERENCES oltp.devices(device_id) 
        ON DELETE CASCADE,
        
    CONSTRAINT fk_case_creator 
        FOREIGN KEY (created_by) 
        REFERENCES oltp.users(user_id)
);

-- Bảng Work Orders 
CREATE TABLE oltp.work_orders (
    work_order_id SERIAL PRIMARY KEY,
    case_id INT REFERENCES oltp.warranty_cases(case_id),
    assigned_to INT REFERENCES oltp.users(user_id),
    status VARCHAR(50),
    start_time TIMESTAMP,
    end_time TIMESTAMP
);

-- =======================================================
-- MỤC 4: KHO & LINH KIỆN
-- =======================================================
-- Bảng parts (Linh kiện)
CREATE TABLE IF NOT EXISTS oltp.parts (
    part_id SERIAL PRIMARY KEY,
    part_name VARCHAR(255) NOT NULL,
    unit VARCHAR(50), -- Cái, Bộ, Chiếc...
    stock_qty INT DEFAULT 0,
    min_stock INT DEFAULT 0 -- Định mức tồn kho tối thiểu để cảnh báo
);

-- Bảng inventory_transactions (Lịch sử nhập/xuất kho)
CREATE TABLE IF NOT EXISTS oltp.inventory_transactions (
    trans_id SERIAL PRIMARY KEY,
    part_id INT REFERENCES oltp.parts(part_id),
    trans_type VARCHAR(50), -- IN (Nhập), OUT (Xuất)
    quantity INT NOT NULL,
    trans_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng work_order_parts (Linh kiện sử dụng cho Work Order)
CREATE TABLE IF NOT EXISTS oltp.work_order_parts (
    wop_id SERIAL PRIMARY KEY,
    work_order_id INT REFERENCES oltp.work_orders(work_order_id) ON DELETE CASCADE,
    part_id INT REFERENCES oltp.parts(part_id),
    quantity INT NOT NULL,
    unit_price DECIMAL(12, 2)
);
-- =======================================================
-- MỤC 5: KIỂM ĐỊNH & BÀN GIAO
-- =======================================================
-- Bảng inspections (Phiếu kiểm định)
CREATE TABLE IF NOT EXISTS oltp.inspections (
    inspection_id SERIAL PRIMARY KEY,
    work_order_id INT REFERENCES oltp.work_orders(work_order_id) ON DELETE CASCADE,
    result VARCHAR(50), -- Pass, Fail
    inspected_by INT REFERENCES oltp.users(user_id),
    inspected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng inspection_items (Chi tiết các mục kiểm tra)
CREATE TABLE IF NOT EXISTS oltp.inspection_items (
    item_id SERIAL PRIMARY KEY,
    inspection_id INT REFERENCES oltp.inspections(inspection_id) ON DELETE CASCADE,
    check_item VARCHAR(255), -- Ví dụ: Màn hình, Pin, Camera
    result VARCHAR(50),
    note TEXT
);

-- Bảng handovers (Biên bản bàn giao)
CREATE TABLE IF NOT EXISTS oltp.handovers (
    handover_id SERIAL PRIMARY KEY,
    case_id INT REFERENCES oltp.warranty_cases(case_id) ON DELETE CASCADE,
    handed_by INT REFERENCES oltp.users(user_id),
    received_by INT REFERENCES oltp.users(user_id), -- Thường là nhân viên kho hoặc lễ tân
    handover_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    feedback TEXT
);

-- =======================================================
-- MỤC 6: SLA 
-- =======================================================
-- Bảng sla_events (Lịch sử sự kiện SLA)
CREATE TABLE IF NOT EXISTS oltp.sla_events (
    event_id SERIAL PRIMARY KEY,
    sla_id INT REFERENCES oltp.sla_instances(sla_id) ON DELETE CASCADE,
    event_type VARCHAR(100), -- Ví dụ: Bắt đầu, Tạm dừng, Vi phạm
    event_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    note TEXT
);

-- Bảng SLA Policies 
CREATE TABLE oltp.sla_policies (
    sla_policy_id SERIAL PRIMARY KEY,
    service_type VARCHAR(100),
    time_limit INT, -- tính bằng phút
    unit VARCHAR(20)
);

-- Bảng SLA Instances 
CREATE TABLE oltp.sla_instances (
    sla_id SERIAL PRIMARY KEY,
    case_id INT REFERENCES oltp.warranty_cases(case_id),
    sla_policy_id INT REFERENCES oltp.sla_policies(sla_policy_id),
    start_time TIMESTAMP,
    deadline TIMESTAMP,
    status VARCHAR(50) 
);

-- =======================================================
-- MỤC 7: WORKFLOW & LỊCH SỬ
-- =======================================================
-- Bảng workflow_transitions (Định nghĩa các luồng trạng thái hợp lệ)
CREATE TABLE IF NOT EXISTS oltp.workflow_transitions (
    transition_id SERIAL PRIMARY KEY,
    from_status VARCHAR(50) NOT NULL,
    to_status VARCHAR(50) NOT NULL,
    role VARCHAR(50), 
    condition TEXT,
    UNIQUE(from_status, to_status)
);

-- Bảng transition_roles (Phân quyền cho luồng trạng thái)
CREATE TABLE IF NOT EXISTS oltp.transition_roles (
    transition_id INT REFERENCES oltp.workflow_transitions(transition_id) ON DELETE CASCADE,
    role_id INT REFERENCES oltp.roles(role_id) ON DELETE CASCADE,
    PRIMARY KEY (transition_id, role_id)
);

-- Bảng case_status_history (Lịch sử thay đổi trạng thái của ca)
CREATE TABLE IF NOT EXISTS oltp.case_status_history (
    history_id SERIAL PRIMARY KEY,
    case_id INT REFERENCES oltp.warranty_cases(case_id) ON DELETE CASCADE,
    transition_id INT REFERENCES oltp.workflow_transitions(transition_id),
    from_status VARCHAR(50),
    to_status VARCHAR(50),
    changed_by INT REFERENCES oltp.users(user_id),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng audit_logs (Nhật ký hệ thống tổng quát)
CREATE TABLE IF NOT EXISTS oltp.audit_logs (
    log_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES oltp.users(user_id),
    entity_type VARCHAR(50), -- Ví dụ: 'warranty_case', 'device'
    entity_id INT,
    action VARCHAR(100), -- CREATE, UPDATE, DELETE
    log_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
