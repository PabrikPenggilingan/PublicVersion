-- Migration 019: Create drying_batches junction table
CREATE TABLE IF NOT EXISTS drying_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drying_id UUID NOT NULL REFERENCES drying_processes(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    tonnage_kg DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(drying_id, batch_id)
);

CREATE INDEX IF NOT EXISTS idx_drying_batches_drying_id ON drying_batches(drying_id);
CREATE INDEX IF NOT EXISTS idx_drying_batches_batch_id ON drying_batches(batch_id);

COMMENT ON TABLE drying_batches IS 'Junction table linking drying processes to batches';
