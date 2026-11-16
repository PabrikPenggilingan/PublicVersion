-- Migration 016: Add is_active column to batches for admin control
ALTER TABLE batches ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Comment for documentation
COMMENT ON COLUMN batches.is_active IS 'When false, batch is inactive and cannot be modified';
