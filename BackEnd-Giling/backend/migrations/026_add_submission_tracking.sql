-- Migration 026: Add submission tracking for rate limiting and PENDING_APPROVAL status
-- Create submission_counts table for rate limiting
CREATE TABLE IF NOT EXISTS submission_counts (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL, -- 'batch', 'drying', 'process'
    entity_id INTEGER NOT NULL,
    submission_count INTEGER DEFAULT 0,
    last_reset_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entity_type, entity_id)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_submission_counts_entity ON submission_counts(entity_type, entity_id);

-- Comments
COMMENT ON TABLE submission_counts IS 'Tracks submission counts for rate limiting on forms';
COMMENT ON COLUMN submission_counts.entity_type IS 'Type: batch, drying, process';
COMMENT ON COLUMN submission_counts.submission_count IS 'Current count of submissions';
