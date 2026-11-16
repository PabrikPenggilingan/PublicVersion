-- Migration 044: Create customer tiers master table
-- Tiers: Ring 1 (prioritas tertinggi), Ring 2, Ring 3, dst.

CREATE TABLE IF NOT EXISTS customer_tiers (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(50) NOT NULL UNIQUE,  -- 'Ring 1', 'Ring 2', 'Ring 3'
    description TEXT,
    sort_order  INT         NOT NULL DEFAULT 99,  -- urutan tampil, makin kecil makin prioritas
    is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_tiers_sort ON customer_tiers(sort_order);

DROP TRIGGER IF EXISTS update_customer_tiers_updated_at ON customer_tiers;
CREATE TRIGGER update_customer_tiers_updated_at BEFORE UPDATE ON customer_tiers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed default tiers
INSERT INTO customer_tiers (name, description, sort_order) VALUES
    ('Ring 1', 'Agen utama / mitra prioritas, volume besar',   1),
    ('Ring 2', 'Agen menengah / distributor lokal',            2),
    ('Ring 3', 'Pengecer / pembeli perorangan / umum',         3)
ON CONFLICT (name) DO NOTHING;

COMMENT ON TABLE customer_tiers IS 'Segmentasi pelanggan berdasarkan level kemitraan dan volume';
