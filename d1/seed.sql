-- Initial Administrator and System Settings for Cloudflare D1 (No seed/dummy assets)

-- 1. Initial System Administrator
INSERT OR IGNORE INTO employees (id, name, username, password, must_change_password, role, position, location, email) VALUES
('emp_admin_system', 'ผู้ดูแลระบบ (Admin)', 'admin', 'admin1234', 0, 'admin', 'ผู้ดูแลระบบสารสนเทศ', 'ศูนย์คอมพิวเตอร์', 'admin@system.local');

-- 2. System Settings
INSERT OR REPLACE INTO system_settings (key, value) VALUES
('orgName', 'บริษัท ควอนตัม ซิสเต็ม โพรเทคชั่น จำกัด'),
('orgSub', 'ระบบทะเบียนคุมทรัพย์สินและครุภัณฑ์ (Asset Registry)'),
('adminPin', '1234');
