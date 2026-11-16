-- Migration: Remove kadar_air and kadar_hampa from purchases table
-- These fields are moved to pendataan_gabah for R&D purposes
-- NOTE: Column `varietas` never existed in purchases (031 fix applied).

-- Migrate existing data to pendataan_gabah if entries don't exist yet
-- We select only columns that actually exist in purchases (003 + 017)
INSERT INTO pendataan_gabah (purchase_id, jenis_gabah, varietas, kondisi_gabah, kadar_air, kadar_hampa, created_by, created_at)
SELECT
    p.id,
    p.jenis_gabah,
    NULL,            -- varietas never existed in purchases table
    p.kondisi_gabah,
    p.kadar_air,
    p.kadar_hampa,
    p.filled_by,
    p.created_at
FROM purchases p
WHERE p.jenis_gabah IS NOT NULL
   OR p.kondisi_gabah IS NOT NULL
   OR p.kadar_air IS NOT NULL
   OR p.kadar_hampa IS NOT NULL
ON CONFLICT (purchase_id) DO NOTHING;

-- Now drop the columns from purchases (only those that actually exist)
ALTER TABLE purchases DROP COLUMN IF EXISTS jenis_gabah;
ALTER TABLE purchases DROP COLUMN IF EXISTS kondisi_gabah;
ALTER TABLE purchases DROP COLUMN IF EXISTS kadar_air;
ALTER TABLE purchases DROP COLUMN IF EXISTS kadar_hampa;
-- varietas: skip (column never existed, nothing to drop)
