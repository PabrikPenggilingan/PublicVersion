-- Migration 034: Create Enterprise Schema Architecture
-- Creates mst, trx, sys, log schemas and migrates key master data tables
-- Strategy: NON-BREAKING - existing tables remain, new schemas are additive

-- ============================================================
-- STEP 1: Create named schemas
-- ============================================================
CREATE SCHEMA IF NOT EXISTS mst; -- Master Data (Reference/Lookup tables)
CREATE SCHEMA IF NOT EXISTS trx; -- Transactions (Business event records)
CREATE SCHEMA IF NOT EXISTS sys; -- System config & metadata
CREATE SCHEMA IF NOT EXISTS log; -- Audit & activity logs

-- ============================================================
-- STEP 2: mst.item_categories (Product Category Master)
-- ============================================================
CREATE TABLE IF NOT EXISTS mst.item_categories (
    id   SERIAL PRIMARY KEY,
    code VARCHAR(30) UNIQUE NOT NULL,  -- e.g. 'GABAH', 'BERAS', 'TURUNAN', 'LIMBAH'
    name VARCHAR(100) NOT NULL,        -- e.g. 'Gabah', 'Beras', 'Produk Turunan', 'Limbah'
    description TEXT,
    color_hex VARCHAR(7),              -- For UI badge coloring e.g. '#F59E0B'
    icon VARCHAR(50),                  -- Icon name hint for frontend
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE mst.item_categories IS 'Master list of product categories used in inventory classification';

-- Seed default categories for rice milling operation
INSERT INTO mst.item_categories (code, name, description, color_hex, icon, sort_order) VALUES
    ('GABAH',   'Gabah',          'Raw paddy (wet or dry) before milling',                '#F59E0B', 'Wheat',        1),
    ('BERAS',   'Beras',          'Milled white rice products (premium, medium, broken)',  '#10B981', 'Package',      2),
    ('TURUNAN', 'Produk Turunan', 'By-products: bran (dedak), rice flour (tepung menir)', '#8B5CF6', 'Layers',       3),
    ('LIMBAH',  'Limbah / Sekam', 'Waste products: rice husk (sekam)',                    '#6B7280', 'Trash2',       4)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- STEP 3: Add product_category_code column to inventory_items
-- ============================================================
-- This allows categorization without breaking the existing schema
ALTER TABLE inventory_items
    ADD COLUMN IF NOT EXISTS product_category_code VARCHAR(30)
        REFERENCES mst.item_categories(code) ON DELETE SET NULL;

-- Default existing inventory items to 'GABAH' (most common case)
UPDATE inventory_items
SET product_category_code = CASE
    WHEN source_type = 'drying' THEN 'GABAH'  -- Dried paddy = GABAH
    WHEN source_type = 'batch'  THEN 'GABAH'  -- Raw batch = GABAH
    ELSE 'GABAH'
END
WHERE product_category_code IS NULL;

-- Index for fast category-based filtering
CREATE INDEX IF NOT EXISTS idx_inventory_items_category
    ON inventory_items(product_category_code);

-- ============================================================
-- STEP 4: mst.item_products (Optional product name master)
-- These are specific named products within a category
-- e.g. "Beras Premium A", "Menir", "Dedak Halus"
-- ============================================================
CREATE TABLE IF NOT EXISTS mst.item_products (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_code VARCHAR(30) NOT NULL REFERENCES mst.item_categories(code),
    code        VARCHAR(50) UNIQUE NOT NULL,   -- e.g. 'BERAS_PREMIUM', 'MENIR', 'DEDAK', 'SEKAM'
    name        VARCHAR(150) NOT NULL,
    unit        VARCHAR(20) DEFAULT 'KG',      -- KG, Karung
    description TEXT,
    is_active   BOOLEAN DEFAULT TRUE,
    sort_order  INTEGER DEFAULT 0,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE mst.item_products IS 'Specific named products within each category. Used for milling output tracking.';

-- Seed common rice milling products
INSERT INTO mst.item_products (category_code, code, name, unit, sort_order) VALUES
    ('GABAH',   'GABAH_KERING_PANEN',  'Gabah Kering Panen (GKP)',     'KG', 1),
    ('GABAH',   'GABAH_KERING_GILING', 'Gabah Kering Giling (GKG)',    'KG', 2),
    ('BERAS',   'BERAS_PREMIUM',       'Beras Kepala / Premium',       'KG', 1),
    ('BERAS',   'BERAS_MEDIUM',        'Beras Medium',                 'KG', 2),
    ('BERAS',   'MENIR',               'Menir / Beras Patah',          'KG', 3),
    ('TURUNAN', 'DEDAK',               'Dedak / Bekatul',              'KG', 1),
    ('TURUNAN', 'TEPUNG_BERAS',        'Tepung Beras',                 'KG', 2),
    ('LIMBAH',  'SEKAM',               'Sekam Padi',                   'KG', 1)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- STEP 5: sys.config (System configuration key-value store)
-- ============================================================
CREATE TABLE IF NOT EXISTS sys.config (
    key         VARCHAR(100) PRIMARY KEY,
    value       TEXT,
    description TEXT,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE sys.config IS 'System-wide configuration key-value pairs';

INSERT INTO sys.config (key, value, description) VALUES
    ('app.version',        '1.1.0',       'Application version'),
    ('app.name',           'Belanja Giling', 'Application display name'),
    ('inventory.fifo',     'true',        'Use FIFO ordering for inventory depletion'),
    ('milling.auto_split', 'true',        'Automatically split milling into product outputs')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Comments
-- ============================================================
COMMENT ON SCHEMA mst IS 'Master data: Reference/lookup tables that change infrequently';
COMMENT ON SCHEMA trx IS 'Transactions: Business event records (inventory movements, sales, purchases)';
COMMENT ON SCHEMA sys IS 'System: Application configuration and metadata';
COMMENT ON SCHEMA log IS 'Logs: Audit trails and activity history';
