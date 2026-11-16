-- Migration 042: Add jenis_gabah to trx.batches

ALTER TABLE trx.batches ADD COLUMN IF NOT EXISTS jenis_gabah VARCHAR(50);

-- Set default value for existing batches
UPDATE trx.batches SET jenis_gabah = 'IR64' WHERE jenis_gabah IS NULL;

-- Update the public.batches view to include the new column
DROP VIEW IF EXISTS public.batches;
CREATE VIEW public.batches AS SELECT * FROM trx.batches;
