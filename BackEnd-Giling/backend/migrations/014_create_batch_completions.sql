-- Migration 014: Create batch_completions table for storing struk and lapangan photos
CREATE TABLE IF NOT EXISTS batch_completions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID UNIQUE NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    struk_photo_path VARCHAR(500),
    lapangan_photo_path VARCHAR(500),
    total_tonnage DECIMAL(12,2),
    total_entries INTEGER DEFAULT 0,
    completed_by UUID REFERENCES users(id),
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for fast lookup by batch_id
CREATE INDEX IF NOT EXISTS idx_batch_completions_batch_id ON batch_completions(batch_id);

-- Comments for documentation
COMMENT ON TABLE batch_completions IS 'Stores completion photos (struk + lapangan) and summary for each batch';
COMMENT ON COLUMN batch_completions.struk_photo_path IS 'Path to receipt/struk photo';
COMMENT ON COLUMN batch_completions.lapangan_photo_path IS 'Path to field proof photo';
