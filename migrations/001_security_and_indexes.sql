-- migrations/001_security_and_indexes.sql
-- Run ONCE against an existing database created before the security update:
--   npx wrangler d1 execute asset-db --remote --file=migrations/001_security_and_indexes.sql
--
-- 1. Remove the legacy plain-text PIN settings (PIN login was removed).
-- 2. Add the query indexes introduced in schema.sql.
-- No column changes: existing plain-text passwords are hashed automatically on each user's next login.

DELETE FROM Settings WHERE key IN ('adminPin', 'userPin');

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
