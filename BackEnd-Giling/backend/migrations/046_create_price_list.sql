-- Migration 046: Create price list table
-- Harga per tier per kategori produk, berlaku mulai tanggal tertentu

CREATE TABLE IF NOT EXISTS price_list (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_id         UUID        NOT NULL REFERENCES customer_tiers(id) ON DELETE CASCADE,
    category_id     INTEGER     NOT NULL REFERENCES mst.item_categories(id) ON DELETE CASCADE,
    price_per_kg    DECIMAL(12,2),           -- Harga per Kg (untuk GABAH, DEDAK, MENIR, SEKAM)
    price_per_sack  DECIMAL(12,2),           -- Harga per Karung (untuk BERAS, opsional)
    effective_date  DATE        NOT NULL DEFAULT CURRENT_DATE,
    notes           TEXT,
    created_by      UUID        REFERENCES sys.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Pastikan harus ada minimal salah satu harga
    CONSTRAINT chk_price_not_null CHECK (
        price_per_kg IS NOT NULL OR price_per_sack IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_price_list_tier_id       ON price_list(tier_id);
CREATE INDEX IF NOT EXISTS idx_price_list_category_id   ON price_list(category_id);
CREATE INDEX IF NOT EXISTS idx_price_list_effective_date ON price_list(effective_date DESC);

DROP TRIGGER IF EXISTS update_price_list_updated_at ON price_list;
CREATE TRIGGER update_price_list_updated_at BEFORE UPDATE ON price_list
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE price_list IS 'Daftar harga jual per tier pelanggan per kategori produk';
COMMENT ON COLUMN price_list.effective_date IS 'Harga berlaku mulai tanggal ini. Sistem selalu pakai harga terbaru (effective_date <= tanggal nota)';
