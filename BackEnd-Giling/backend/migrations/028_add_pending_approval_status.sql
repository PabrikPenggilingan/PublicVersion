-- Migration 028: Add PENDING_APPROVAL to drying_processes status check
-- Drop existing constraint and add new one with PENDING_APPROVAL

-- First drop the old constraint if exists
ALTER TABLE drying_processes DROP CONSTRAINT IF EXISTS drying_processes_status_check;

-- Add new constraint with PENDING_APPROVAL
ALTER TABLE drying_processes ADD CONSTRAINT drying_processes_status_check 
    CHECK (status IN ('PENDING', 'IN_PROGRESS', 'PENDING_APPROVAL', 'COMPLETED'));
