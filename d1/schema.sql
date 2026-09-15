-- Cloudflare D1 Database Schema for Asset Management System (system-assets)
-- Generated to match current application data models (No cost, No useful_life)

PRAGMA foreign_keys = ON;

-- 1. Departments (หน่วยงาน/ฝ่าย)
CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Employees & Users (บุคลากรและผู้ใช้งานระบบ)
CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT,
    must_change_password INTEGER DEFAULT 0,
    role TEXT CHECK(role IN ('admin', 'staff', 'user')) DEFAULT 'user',
    position TEXT,
    department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
    location TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Categories (หมวดหมู่ทรัพย์สิน)
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Assets (ทะเบียนทรัพย์สิน)
CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category_id TEXT REFERENCES categories(id) ON DELETE RESTRICT,
    department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
    holder_id TEXT REFERENCES employees(id) ON DELETE SET NULL,
    holder_name TEXT,
    purchase_date TEXT,
    return_date TEXT,
    status TEXT CHECK(status IN ('ready', 'issued', 'borrowed', 'repair', 'broken', 'awaiting_parts')) DEFAULT 'ready',
    location TEXT,
    vendor TEXT,
    serial TEXT,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Asset Assignments / Checkout (การเบิก–ยืม และส่งมอบ)
CREATE TABLE IF NOT EXISTS assignments (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    department_id TEXT REFERENCES departments(id) ON DELETE SET NULL,
    date_out TEXT NOT NULL,
    date_return TEXT,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Maintenance Records (ประวัติการซ่อมบำรุง)
CREATE TABLE IF NOT EXISTS maintenance (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    vendor TEXT,
    description TEXT,
    status TEXT CHECK(status IN ('in_progress', 'done')) DEFAULT 'in_progress',
    completed_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. System Settings & Sequences (การตั้งค่าระบบ)
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_employees_username ON employees(username);
CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_categories_code ON categories(code);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category_id);
CREATE INDEX IF NOT EXISTS idx_assets_dept ON assets(department_id);
CREATE INDEX IF NOT EXISTS idx_assets_holder ON assets(holder_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_serial ON assets(serial);
CREATE INDEX IF NOT EXISTS idx_assignments_asset ON assignments(asset_id);
CREATE INDEX IF NOT EXISTS idx_assignments_emp ON assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_asset ON maintenance(asset_id);
