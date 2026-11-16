-- Migration 069: Split Gabah Categories to GABAH_BASAH and GABAH_KERING

-- 1. Insert Master Data Baru
INSERT INTO mst.item_categories (code, name, description, color_hex, icon, sort_order) VALUES
    ('GABAH_BASAH', 'Gabah Basah', 'Gabah basah (kering panen) sebelum dikeringkan', '#F59E0B', 'Wheat', 1),
    ('GABAH_KERING', 'Gabah Kering', 'Gabah kering (kering giling) siap giling', '#F59E0B', 'Wheat', 2)
ON CONFLICT (code) DO NOTHING;

-- 2. Migrasi Data Inventory (trx.inventory_items)
-- GABAH_TITIPAN with subtype 'basah' becomes GABAH_BASAH
UPDATE trx.inventory_items 
SET product_category_code = 'GABAH_BASAH' 
WHERE product_category_code = 'GABAH_TITIPAN' AND titipan_subtype = 'basah';

-- Remaining GABAH_TITIPAN becomes GABAH_KERING
UPDATE trx.inventory_items 
SET product_category_code = 'GABAH_KERING' 
WHERE product_category_code = 'GABAH_TITIPAN';

-- Legacy GABAH becomes GABAH_KERING
UPDATE trx.inventory_items 
SET product_category_code = 'GABAH_KERING' 
WHERE product_category_code = 'GABAH';

-- 3. Migrasi Data Produk (mst.item_products)
UPDATE mst.item_products 
SET category_code = 'GABAH_KERING' 
WHERE category_code IN ('GABAH', 'GABAH_TITIPAN');

-- 4. Migrasi Harga (mst.price_list)
DO $$
DECLARE
    v_gabah_kering_id INTEGER;
    v_gabah_id INTEGER;
    v_gabah_titipan_id INTEGER;
BEGIN
    SELECT id INTO v_gabah_kering_id FROM mst.item_categories WHERE code = 'GABAH_KERING';
    
    -- Safe select for GABAH
    SELECT id INTO v_gabah_id FROM mst.item_categories WHERE code = 'GABAH';
    
    -- Safe select for GABAH_TITIPAN
    SELECT id INTO v_gabah_titipan_id FROM mst.item_categories WHERE code = 'GABAH_TITIPAN';

    IF v_gabah_id IS NOT NULL THEN
        UPDATE mst.price_list SET category_id = v_gabah_kering_id WHERE category_id = v_gabah_id;
    END IF;

    IF v_gabah_titipan_id IS NOT NULL THEN
        UPDATE mst.price_list SET category_id = v_gabah_kering_id WHERE category_id = v_gabah_titipan_id;
    END IF;
END $$;

-- 5. Pembersihan (Cleanup)
DELETE FROM mst.item_categories WHERE code IN ('GABAH', 'GABAH_TITIPAN');
