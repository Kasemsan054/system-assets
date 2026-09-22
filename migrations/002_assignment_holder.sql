-- migrations/002_assignment_holder.sql
-- Run ONCE against an existing database:
--   npx wrangler d1 execute asset-db --remote --file=migrations/002_assignment_holder.sql
--
-- Adds a free-text holder name to Assignments so an asset lent to a customer, or to a
-- person who has no staff record, can be tracked on the assignments page too.
-- Additive and safe; existing rows keep NULL. (SQLite has no ADD COLUMN IF NOT EXISTS,
-- so run this only once — re-running errors with "duplicate column name".)

ALTER TABLE Assignments ADD COLUMN holderName TEXT;
