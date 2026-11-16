-- Migration: Create pendataan_gabah table for internal R&D data collection
-- This table stores detailed grain data linked to purchases (batch gabah)

CREATE TABLE IF NOT EXISTS pendataan_gabah (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID NOT NULL UNIQUE REFERENCES purchases(id) ON DELETE CASCADE,
    jenis_gabah VARCHAR(100),
    varietas VARCHAR(100),
    kondisi_gabah TEXT,
    kadar_air DECIMAL(5,2),           -- Moisture content percentage
    kadar_hampa DECIMAL(5,2),         -- Empty grain percentage
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookup by purchase
CREATE INDEX IF NOT EXISTS idx_pendataan_purchase ON pendataan_gabah(purchase_id);

-- Index for filtering by created_by
CREATE INDEX IF NOT EXISTS idx_pendataan_created_by ON pendataan_gabah(created_by);

COMMENT ON TABLE pendataan_gabah IS 'Internal R&D data collection for grain batches';
COMMENT ON COLUMN pendataan_gabah.jenis_gabah IS 'Type of grain (e.g., IR64, Ciherang)';
COMMENT ON COLUMN pendataan_gabah.varietas IS 'Grain variety';
COMMENT ON COLUMN pendataan_gabah.kondisi_gabah IS 'Condition of grain';
COMMENT ON COLUMN pendataan_gabah.kadar_air IS 'Moisture content in percentage';
COMMENT ON COLUMN pendataan_gabah.kadar_hampa IS 'Empty grain percentage';
