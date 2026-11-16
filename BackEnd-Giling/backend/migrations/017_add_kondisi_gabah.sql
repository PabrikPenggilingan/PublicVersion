-- Migration 017: Add kondisi_gabah column for grain condition (dry/wet)
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS kondisi_gabah VARCHAR(20) DEFAULT 'kering';

-- Drop constraint if exists and recreate
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS chk_kondisi_gabah;
ALTER TABLE purchases ADD CONSTRAINT chk_kondisi_gabah CHECK (kondisi_gabah IN ('kering', 'basah'));

-- Comment for documentation
COMMENT ON COLUMN purchases.kondisi_gabah IS 'Grain condition: kering (dry) or basah (wet)';
