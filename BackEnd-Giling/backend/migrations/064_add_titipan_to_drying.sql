-- Migration 064: Add Titipan flag to drying processes

ALTER TABLE trx.drying_processes ADD COLUMN IF NOT EXISTS is_titipan BOOLEAN DEFAULT FALSE;
ALTER TABLE trx.drying_processes ADD COLUMN IF NOT EXISTS titipan_data JSONB;

INSERT INTO mst.item_categories (code, name, description, color_hex, icon, sort_order) VALUES
    ('GABAH_TITIPAN', 'Gabah Titipan', 'Gabah konsinyasi/titipan dari pelanggan', '#06B6D4', 'Truck', 5)
ON CONFLICT (code) DO NOTHING;
