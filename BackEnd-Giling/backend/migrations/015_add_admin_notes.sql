-- Migration 015: Add admin_notes column to purchases for tracking manual admin entries
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Comment for documentation
COMMENT ON COLUMN purchases.admin_notes IS 'Admin notes explaining why this purchase was entered manually from dashboard';
