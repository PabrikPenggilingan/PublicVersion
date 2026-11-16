-- Migration 011: Add filled_by column to purchases for employee tracking
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS filled_by UUID REFERENCES users(id);

-- Add index for filled_by queries
CREATE INDEX IF NOT EXISTS idx_purchases_filled_by ON purchases(filled_by);

-- Comment for documentation
COMMENT ON COLUMN purchases.filled_by IS 'Employee who filled this purchase form';
