-- Migration 082: Relax check_max_duration constraint on processes
-- The original constraint (2 days) is too strict for real-world milling operations.
-- Increase to 90 days to accommodate processes that span multiple days/weeks.

ALTER TABLE trx.processes
    DROP CONSTRAINT IF EXISTS check_max_duration;

ALTER TABLE trx.processes
    ADD CONSTRAINT check_max_duration
    CHECK (end_date IS NULL OR end_date <= process_date + INTERVAL '90 days');
