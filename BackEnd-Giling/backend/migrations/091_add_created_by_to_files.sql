-- Migration 091: Add created_by to trx.files for storage attribution per user
-- This allows the admin monitoring module to show storage usage per user.
--
-- Attribution logic:
-- A file's "owner" is the user who uploaded it. Since uploads happen via
-- authenticated routes, we can backfill by linking purchase -> filled_by,
-- process -> created_by, and sales -> created_by as approximations.
-- Going forward, all new uploads will have created_by set from req.user.id.

ALTER TABLE trx.files
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES sys.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_files_created_by ON trx.files(created_by);

-- Backfill: attribute existing purchase files to the user who filled the purchase
UPDATE trx.files f
SET created_by = p.filled_by
FROM trx.purchases p
WHERE f.purchase_id = p.id
  AND f.created_by IS NULL
  AND p.filled_by IS NOT NULL;

-- Backfill: attribute existing process files to the user who created the process
UPDATE trx.files f
SET created_by = pr.created_by
FROM trx.processes pr
WHERE f.process_id = pr.id
  AND f.created_by IS NULL
  AND pr.created_by IS NOT NULL;

-- Backfill: attribute existing sale files to the user who created the sale
UPDATE trx.files f
SET created_by = s.created_by
FROM trx.sales s
WHERE f.sale_id = s.id
  AND f.created_by IS NULL
  AND s.created_by IS NOT NULL;

COMMENT ON COLUMN trx.files.created_by IS
  'User who uploaded the file. Used by admin monitoring for per-user storage attribution.';
