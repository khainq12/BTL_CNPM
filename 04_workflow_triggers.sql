--  Function kiểm tra logic
CREATE OR REPLACE FUNCTION oltp.check_valid_status_transition()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id INT;
    v_role_id INT;
    v_is_valid BOOLEAN;
BEGIN
    -- Chỉ kiểm tra khi trạng thái thực sự thay đổi
    IF NEW.status <> OLD.status THEN
        
        -- Lấy ID user hiện tại từ session (do Backend truyền vào)
        -- SỬA LẠI: Dùng NULLIF để biến chuỗi rỗng '' thành NULL trước khi ép kiểu
        v_user_id := NULLIF(current_setting('app.current_user_id', true), '')::INT;
        
        -- Nếu không có user (chạy test trực tiếp trên DB), bỏ qua check quyền
        IF v_user_id IS NULL THEN
            RETURN NEW;
        END IF;

        -- Lấy role của user đó (giả sử 1 user có 1 role chính)
        SELECT role_id INTO v_role_id FROM oltp.user_roles WHERE user_id = v_user_id LIMIT 1;

        -- Kiểm tra xem luồng chuyển trạng thái này có hợp lệ với Role này không
        SELECT EXISTS (
            SELECT 1 
            FROM oltp.workflow_transitions wt
            JOIN oltp.transition_roles tr ON wt.transition_id = tr.transition_id
            WHERE wt.from_status = OLD.status 
              AND wt.to_status = NEW.status
              AND tr.role_id = v_role_id
        ) INTO v_is_valid;

        -- Nếu không hợp lệ -> Báo lỗi và hủy giao dịch
        IF NOT v_is_valid THEN
            RAISE EXCEPTION 'LỖI WORKFLOW: Tài khoản của bạn (Role ID: %) không được phép chuyển trạng thái từ "%" sang "%"', v_role_id, OLD.status, NEW.status;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Gắn Trigger vào bảng warranty_cases (BEFORE UPDATE để chặn trước khi lưu)
DROP TRIGGER IF EXISTS trg_check_status_transition ON oltp.warranty_cases;
CREATE TRIGGER trg_check_status_transition
BEFORE UPDATE OF status ON oltp.warranty_cases
FOR EACH ROW EXECUTE FUNCTION oltp.check_valid_status_transition();


CREATE OR REPLACE FUNCTION oltp.log_status_history()
RETURNS TRIGGER AS $$
DECLARE
    v_current_user_id INT;
    v_transition_id INT;
BEGIN
    IF NEW.status <> OLD.status THEN
        -- SỬA LẠI TẠI ĐÂY: Thêm NULLIF để tránh lỗi chuỗi rỗng ""
        v_current_user_id := NULLIF(current_setting('app.current_user_id', true), '')::INT;
        
        -- Tìm ID của luồng chuyển đổi
        SELECT transition_id INTO v_transition_id 
        FROM oltp.workflow_transitions 
        WHERE from_status = OLD.status AND to_status = NEW.status LIMIT 1;

        -- Ghi vào bảng lịch sử
        INSERT INTO oltp.case_status_history (
            case_id, transition_id, from_status, to_status, changed_by
        ) VALUES (
            NEW.case_id, v_transition_id, OLD.status, NEW.status, COALESCE(v_current_user_id, 1)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Gắn Trigger (AFTER UPDATE để chạy sau khi update thành công)
DROP TRIGGER IF EXISTS trg_log_status_history ON oltp.warranty_cases;
CREATE TRIGGER trg_log_status_history
AFTER UPDATE OF status ON oltp.warranty_cases
FOR EACH ROW EXECUTE FUNCTION oltp.log_status_history();
