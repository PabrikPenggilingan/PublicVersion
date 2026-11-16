-- Migration 023: Add name column to drying_processes
ALTER TABLE drying_processes ADD COLUMN IF NOT EXISTS name VARCHAR(255);

COMMENT ON COLUMN drying_processes.name IS 'Custom name for the drying process';
