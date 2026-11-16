-- Migration 013: Create purchase_photos table for storing gabah photos per purchase
CREATE TABLE IF NOT EXISTS purchase_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for fast lookup by purchase_id
CREATE INDEX IF NOT EXISTS idx_purchase_photos_purchase_id ON purchase_photos(purchase_id);

-- Comment for documentation
COMMENT ON TABLE purchase_photos IS 'Stores 1-3 gabah photos per purchase entry';
