-- Migration 012: Create batch_links table for publishable form links
CREATE TABLE IF NOT EXISTS batch_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    link_code VARCHAR(10) UNIQUE NOT NULL,
    form_type VARCHAR(20) DEFAULT 'PURCHASE',
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_batch_links_batch_id ON batch_links(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_links_link_code ON batch_links(link_code);
CREATE INDEX IF NOT EXISTS idx_batch_links_is_active ON batch_links(is_active);

-- Add constraint for unique active link per batch per form_type
CREATE UNIQUE INDEX IF NOT EXISTS idx_batch_links_unique_active 
    ON batch_links(batch_id, form_type) 
    WHERE is_active = true;

-- Comments
COMMENT ON TABLE batch_links IS 'Publishable links for employee forms';
COMMENT ON COLUMN batch_links.link_code IS 'Short unique code for URL (e.g., ABC123)';
COMMENT ON COLUMN batch_links.form_type IS 'Type of form: PURCHASE, DRYING, MILLING, SALES';
