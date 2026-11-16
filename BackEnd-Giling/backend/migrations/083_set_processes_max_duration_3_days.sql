-- Migration 083: Set check_max_duration constraint on processes to 3 days
-- User requested 3 days instead of 90.

ALTER TABLE trx.processes
    DROP CONSTRAINT IF EXISTS check_max_duration;

ALTER TABLE trx.processes
    ADD CONSTRAINT check_max_duration
    CHECK (end_date IS NULL OR end_date <= process_date + INTERVAL '3 days');
