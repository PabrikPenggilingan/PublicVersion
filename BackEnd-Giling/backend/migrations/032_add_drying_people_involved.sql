-- Migration: Add people_involved field to drying_processes table
-- This field stores free-text list of people involved in the drying process

ALTER TABLE drying_processes ADD COLUMN IF NOT EXISTS people_involved TEXT;

COMMENT ON COLUMN drying_processes.people_involved IS 'Free-text list of people involved in drying process';
