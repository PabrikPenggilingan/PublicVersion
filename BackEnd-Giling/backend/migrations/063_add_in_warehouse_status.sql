-- Migration 063: Add IN_WAREHOUSE status to drying_processes
-- This status is set when an approved drying process has been successfully transferred to inventory.

-- Drop existing constraint
ALTER TABLE trx.drying_processes DROP CONSTRAINT IF EXISTS drying_processes_status_check;

-- Add new constraint including IN_WAREHOUSE
ALTER TABLE trx.drying_processes ADD CONSTRAINT drying_processes_status_check
    CHECK (status IN ('PENDING', 'IN_PROGRESS', 'PENDING_APPROVAL', 'COMPLETED', 'IN_WAREHOUSE'));
