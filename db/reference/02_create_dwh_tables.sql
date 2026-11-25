
-- 1. TẠO CÁC BẢNG DIMENSION (BẢNG CHIỀU)


-- Dim Date 
CREATE TABLE dwh.dim_date (
    date_key INT PRIMARY KEY, -- Định dạng YYYYMMDD
    date DATE NOT NULL,
    month INT NOT NULL,
    quarter INT NOT NULL,
    year INT NOT NULL
);

-- Dim Device (Thiết bị)
CREATE TABLE dwh.dim_device (
    device_key SERIAL PRIMARY KEY, -- Khóa thay thế (Surrogate Key)
    oltp_device_id INT,            -- Khóa gốc để map dữ liệu (dùng cho ETL)
    brand VARCHAR(100),
    model VARCHAR(100),
    category VARCHAR(100)
);

-- Dim Technician 
CREATE TABLE dwh.dim_technician (
    technician_key SERIAL PRIMARY KEY,
    oltp_user_id INT,              -- Khóa gốc
    full_name VARCHAR(255),
    team VARCHAR(100),
    skill_level VARCHAR(50)
);

-- Dim Service Type 
CREATE TABLE dwh.dim_service_type (
    service_key SERIAL PRIMARY KEY,
    service_type VARCHAR(100),
    priority VARCHAR(50)
);

-- Dim Status 
CREATE TABLE dwh.dim_status (
    status_key SERIAL PRIMARY KEY,
    status_name VARCHAR(100),
    stage VARCHAR(100)
);


-- 2. TẠO CÁC BẢNG FACT 


-- Fact Warranty Case (Ca bảo hành)
CREATE TABLE dwh.fact_warranty_case (
    case_key SERIAL PRIMARY KEY,
    oltp_case_id INT UNIQUE,       -- Lưu ID gốc để tránh insert trùng
    date_key INT REFERENCES dwh.dim_date(date_key),
    device_key INT REFERENCES dwh.dim_device(device_key),
    technician_key INT REFERENCES dwh.dim_technician(technician_key),
    process_time_minutes INT,      -- Thời gian xử lý (phút)
    rework_count INT DEFAULT 0     -- Số lần làm lại
);

-- Fact SLA (Vi phạm SLA)
CREATE TABLE dwh.fact_sla (
    sla_key SERIAL PRIMARY KEY,
    date_key INT REFERENCES dwh.dim_date(date_key),
    policy_key INT,                -- ID của chính sách SLA
    breach_flag BOOLEAN,           -- True nếu vi phạm
    breach_minutes INT             -- Số phút vi phạm
);

-- Fact Case Status Duration (Thời gian ca nằm ở trạng thái)
CREATE TABLE dwh.fact_case_status_duration (
    case_key INT REFERENCES dwh.fact_warranty_case(case_key),
    status_key INT REFERENCES dwh.dim_status(status_key),
    date_key INT REFERENCES dwh.dim_date(date_key),
    duration_minutes INT,
    PRIMARY KEY (case_key, status_key, date_key) -- Khóa phức hợp
);