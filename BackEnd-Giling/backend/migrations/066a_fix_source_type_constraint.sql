-- Migration 066: Fix source type check constraint
ALTER TABLE trx.inventory_items DROP CONSTRAINT IF EXISTS inventory_items_source_type_check;
ALTER TABLE trx.inventory_items ADD CONSTRAINT inventory_items_source_type_check 
CHECK (source_type IN ('batch', 'drying', 'process', 'manual', 'titipan_basah', 'titipan_kering'));
