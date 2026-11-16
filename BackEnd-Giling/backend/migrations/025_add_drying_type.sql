-- Migration 025: Add drying type and vendor name
-- Add drying_type column (oven_mandiri, oven_vendor, jemur_mandiri, jemur_vendor)
ALTER TABLE drying_processes ADD COLUMN IF NOT EXISTS drying_type VARCHAR(50) DEFAULT 'oven_mandiri';

-- Add vendor_name column (for vendor types)
ALTER TABLE drying_processes ADD COLUMN IF NOT EXISTS vendor_name VARCHAR(255);

-- Comments
COMMENT ON COLUMN drying_processes.drying_type IS 'Type of drying: oven_mandiri, oven_vendor, jemur_mandiri, jemur_vendor';
COMMENT ON COLUMN drying_processes.vendor_name IS 'Vendor name for vendor type drying processes';
