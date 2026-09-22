-- D1 Database Schema for Asset Management System
-- Safe to run repeatedly (IF NOT EXISTS / OR IGNORE everywhere).
-- For an existing database also run migrations/001_security_and_indexes.sql once.

CREATE TABLE IF NOT EXISTS Categories (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    usefulLife INTEGER DEFAULT 5,
    salvagePct INTEGER DEFAULT 5
);

CREATE TABLE IF NOT EXISTS Departments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    departmentId TEXT,
    position TEXT,
    location TEXT
);

CREATE TABLE IF NOT EXISTS Assets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    categoryId TEXT,
    departmentId TEXT,
    holderId TEXT,
    holderName TEXT,
    purchaseDate TEXT,
    cost REAL,
    usefulLife INTEGER,
    salvagePct INTEGER,
    status TEXT DEFAULT 'ready',
    location TEXT,
    vendor TEXT,
    serial TEXT,
    note TEXT,
    returnDate TEXT
);

CREATE TABLE IF NOT EXISTS Assignments (
    id TEXT PRIMARY KEY,
    assetId TEXT NOT NULL,
    employeeId TEXT,
    departmentId TEXT,
    holderName TEXT,          -- free-text holder (customer / person without a staff record)
    dateOut TEXT,
    dateReturn TEXT,
    note TEXT
);

CREATE TABLE IF NOT EXISTS Maintenance (
    id TEXT PRIMARY KEY,
    assetId TEXT NOT NULL,
    date TEXT,
    type TEXT,
    vendor TEXT,
    description TEXT,
    status TEXT DEFAULT 'in_progress',
    cost REAL,
    completedDate TEXT
);

-- Keys starting with '_' are server-internal (e.g. _authSecret) and never returned by the API.
CREATE TABLE IF NOT EXISTS Settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- password: PBKDF2-SHA256 hash ("pbkdf2$iter$salt$hash"). A plain-text value is accepted
-- once and upgraded to a hash on the user's next successful login.
CREATE TABLE IF NOT EXISTS Users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user', -- 'admin' or 'user'
    employeeId TEXT,
    departmentId TEXT,
    permissions TEXT, -- JSON array of module permissions e.g. '["assets","categories"]'
    mustChangePassword INTEGER DEFAULT 1,
    createdAt TEXT
);

CREATE TABLE IF NOT EXISTS ActivityLogs (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    module TEXT NOT NULL,
    targetId TEXT,
    targetName TEXT,
    details TEXT,
    userName TEXT NOT NULL,
    userRole TEXT,
    createdAt TEXT NOT NULL
);

-- Indexes for the filters the API actually uses
CREATE INDEX IF NOT EXISTS idx_assets_category   ON Assets(categoryId);
CREATE INDEX IF NOT EXISTS idx_assets_department ON Assets(departmentId);
CREATE INDEX IF NOT EXISTS idx_assets_holder     ON Assets(holderId);
CREATE INDEX IF NOT EXISTS idx_assets_status     ON Assets(status);
CREATE INDEX IF NOT EXISTS idx_assignments_asset ON Assignments(assetId);
CREATE INDEX IF NOT EXISTS idx_assignments_emp   ON Assignments(employeeId);
CREATE INDEX IF NOT EXISTS idx_maintenance_asset ON Maintenance(assetId);
CREATE INDEX IF NOT EXISTS idx_maintenance_stat  ON Maintenance(status);
CREATE INDEX IF NOT EXISTS idx_employees_dept    ON Employees(departmentId);
CREATE INDEX IF NOT EXISTS idx_users_employee    ON Users(employeeId);
CREATE INDEX IF NOT EXISTS idx_logs_created      ON ActivityLogs(createdAt DESC);
CREATE INDEX IF NOT EXISTS idx_logs_target       ON ActivityLogs(targetId);
CREATE INDEX IF NOT EXISTS idx_logs_module       ON ActivityLogs(module);

-- Default branding
INSERT OR IGNORE INTO Settings (key, value) VALUES ('orgName', 'องค์กรของคุณ');
INSERT OR IGNORE INTO Settings (key, value) VALUES ('orgSub', 'ระบบทะเบียนทรัพย์สิน');

-- Default admin (password 'admin123' — stored plain here, hashed automatically on first login;
-- mustChangePassword=1 forces a new password immediately).
INSERT OR IGNORE INTO Users (id, username, password, name, role, employeeId, departmentId, permissions, mustChangePassword, createdAt)
VALUES ('usr_admin', 'admin', 'admin123', 'ผู้ดูแลระบบ', 'admin', NULL, NULL, '["*"]', 1, '2026-09-17 00:00:00');
