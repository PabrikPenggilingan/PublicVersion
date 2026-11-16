-- Migration 024: Add is_active to drying_processes and tonnage to sessions
-- Add is_active column to drying_processes
ALTER TABLE drying_processes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Add tonnage fields to drying_sessions
ALTER TABLE drying_sessions ADD COLUMN IF NOT EXISTS tonnage_kg DECIMAL(10,2);

-- Make moisture_content optional (already nullable, but ensure)
ALTER TABLE drying_sessions ALTER COLUMN moisture_content DROP NOT NULL;

-- Make employee_name nullable in drying_links (no longer required)
ALTER TABLE drying_links ALTER COLUMN employee_name DROP NOT NULL;
ALTER TABLE drying_links ALTER COLUMN employee_name SET DEFAULT 'Pengguna Form';

-- Comments
COMMENT ON COLUMN drying_processes.is_active IS 'Active/inactive status for drying process';
COMMENT ON COLUMN drying_sessions.tonnage_kg IS 'Tonnage at time of session submission';
