-- Migration: Add butir_rusak and benda_asing to pendataan_gabah table
-- These are additional quality parameters for R&D analysis

ALTER TABLE pendataan_gabah 
ADD COLUMN IF NOT EXISTS butir_rusak DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS benda_asing DECIMAL(5,2);

COMMENT ON COLUMN pendataan_gabah.butir_rusak IS 'Damaged grain percentage';
COMMENT ON COLUMN pendataan_gabah.benda_asing IS 'Foreign matter percentage';
