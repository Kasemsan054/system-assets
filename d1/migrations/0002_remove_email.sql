-- Migration to remove unused email column from employees table
ALTER TABLE employees DROP COLUMN email;
