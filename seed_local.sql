-- seed_local.sql - Local Database Seed Script for Testing

-- 1. Clean existing test data
DELETE FROM Assets;
DELETE FROM Assignments;
DELETE FROM Maintenance;
DELETE FROM Employees;
DELETE FROM Departments;
DELETE FROM Categories;
DELETE FROM Users;
DELETE FROM Settings;

-- 2. Settings
INSERT INTO Settings (key, value) VALUES ('orgName', 'บริษัท ควอดเอล จำกัด (สำนักงานใหญ่)');
INSERT INTO Settings (key, value) VALUES ('orgSub', 'ระบบบริหารจัดการทะเบียนทรัพย์สิน');

-- 3. Departments (แผนก)
INSERT INTO Departments (id, name) VALUES 
('dep_it', 'แผนกเทคโนโลยีสารสนเทศ (IT)'),
('dep_ac', 'แผนกบัญชีและการเงิน'),
('dep_hr', 'แผนกทรัพยากรบุคคล'),
('dep_op', 'แผนกปฏิบัติการและธุรการ');

-- 4. Employees (with explicit employee_id as Primary Key and position/location)
INSERT INTO Employees (id, name, departmentId, position, location) VALUES 
('EMP001', 'นายสมชาย ใจดี', 'dep_it', 'เจ้าหน้าที่พัสดุและไอที', 'เจ้าหน้าที่พัสดุและไอที'),
('EMP002', 'น.ส.สมหญิง สุขใจ', 'dep_ac', 'หัวหน้าแผนกบัญชี', 'หัวหน้าแผนกบัญชี'),
('EMP003', 'นายกิตติศักดิ์ พัฒนา', 'dep_hr', 'ช่างเทคนิคซ่อมบำรุง', 'ช่างเทคนิคซ่อมบำรุง'),
('EMP004', 'น.ส.วิภาดา รุ่งเรือง', 'dep_op', 'พนักงานทั่วไป', 'พนักงานทั่วไป');

-- 5. Users (username == employee_id, permissions, mustChangePassword)
-- Passwords are seeded as plain text for convenience; the API hashes each one (PBKDF2) on that user's first login.
INSERT INTO Users (id, username, password, name, role, employeeId, departmentId, permissions, mustChangePassword, createdAt) VALUES 
('usr_admin', 'admin', 'admin123', 'ผู้ดูแลระบบ (Admin)', 'admin', NULL, NULL, '["*"]', 0, '2026-09-17 08:00:00'),
('usr_emp001', 'EMP001', 'pass1234', 'นายสมชาย ใจดี', 'user', 'EMP001', 'dep_it', '["assets","categories","assignments"]', 1, '2026-09-17 08:00:00'),
('usr_emp002', 'EMP002', 'pass5678', 'น.ส.สมหญิง สุขใจ', 'user', 'EMP002', 'dep_ac', '["assignments"]', 1, '2026-09-17 08:00:00'),
('usr_emp003', 'EMP003', 'pass1234', 'นายกิตติศักดิ์ พัฒนา', 'user', 'EMP003', 'dep_hr', '["maintenance"]', 1, '2026-09-17 08:00:00'),
('usr_emp004', 'EMP004', 'pass1234', 'น.ส.วิภาดา รุ่งเรือง', 'user', 'EMP004', 'dep_op', '[]', 1, '2026-09-17 08:00:00');

-- 6. Categories
INSERT INTO Categories (id, code, name, usefulLife, salvagePct) VALUES 
('cat_it', 'IT', 'คอมพิวเตอร์และอุปกรณ์ไอที', 5, 5),
('cat_of', 'OF', 'ครุภัณฑ์และเฟอร์นิเจอร์สำนักงาน', 5, 10),
('cat_el', 'EL', 'เครื่องใช้ไฟฟ้าและเครื่องปรับอากาศ', 5, 5),
('cat_vh', 'VH', 'ยานพาหนะและขนส่ง', 8, 10);

-- 7. Assets
INSERT INTO Assets (id, name, categoryId, departmentId, holderId, purchaseDate, cost, usefulLife, salvagePct, status, location, vendor, serial, note) VALUES 
('PF-29X810', 'แล็ปท็อป Lenovo ThinkPad T14', 'cat_it', 'dep_it', 'EMP001', '2025-06-15', 38500, 5, 5, 'issued', 'ห้อง IT ชั้น 2', 'Lenovo Thailand', 'PF-29X810', 'เครื่องประจำตำแหน่ง'),
('HP-LJ-9921', 'เครื่องพิมพ์มัลติฟังก์ชัน HP LaserJet Pro', 'cat_of', 'dep_ac', 'EMP002', '2024-11-20', 14900, 5, 10, 'ready', 'ฝ่ายบัญชี ชั้น 3', 'OfficeMate', 'HP-LJ-9921', 'ใช้งานร่วมในฝ่าย'),
('DELL-U27-440', 'จอมอนิเตอร์ Dell UltraSharp 27 นิ้ว 4K', 'cat_it', 'dep_it', 'EMP001', '2025-08-01', 11500, 5, 5, 'issued', 'ห้อง IT ชั้น 2', 'Dell Direct', 'DELL-U27-440', 'ต่อคู่กับแล็ปท็อป'),
('DK-INV-7731', 'เครื่องปรับอากาศ Daikin Inverter 18,000 BTU', 'cat_el', 'dep_op', NULL, '2023-04-10', 24500, 5, 5, 'ready', 'ห้องประชุมใหญ่ ชั้น 1', 'Daikin Service', 'DK-INV-7731', 'ตรวจสภาพทุก 6 เดือน');

-- 8. Assignments
INSERT INTO Assignments (id, assetId, employeeId, departmentId, dateOut, dateReturn, note) VALUES 
('asg_1', 'PF-29X810', 'EMP001', 'dep_it', '2025-06-16', NULL, 'มอบหมายให้ใช้งานประจำ'),
('asg_2', 'DELL-U27-440', 'EMP001', 'dep_it', '2025-08-02', NULL, 'เบิกจอเสริม');

-- 9. Maintenance
INSERT INTO Maintenance (id, assetId, date, type, vendor, description, status, completedDate) VALUES 
('mnt_1', 'HP-LJ-9921', '2026-08-10', 'ซ่อมแซม', 'HP Authorized Service', 'เปลี่ยนลูกกลิ้งดึงกระดาษและทำความสะอาด', 'done', '2026-08-12');
