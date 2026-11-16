-- Migration 065: Add Gabah Titipan support to inventory items
-- Tracks titipan subtype (basah/kering) directly on inventory items
-- and links a drying process back to its source titipan inventory item

-- inventory_items: titipan tracking columns
ALTER TABLE trx.inventory_items
    ADD COLUMN IF NOT EXISTS is_titipan       BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS titipan_subtype  TEXT CHECK (titipan_subtype IN ('basah', 'kering')),
    ADD COLUMN IF NOT EXISTS titipan_data     JSONB;
-- titipan_data shape: { pemilikNama: string, jenisGabah: string, beratKg: number }

-- drying_processes: link back to the titipan basah inventory item that was selected
ALTER TABLE trx.drying_processes
    ADD COLUMN IF NOT EXISTS titipan_inventory_id UUID REFERENCES trx.inventory_items(id) ON DELETE SET NULL;
