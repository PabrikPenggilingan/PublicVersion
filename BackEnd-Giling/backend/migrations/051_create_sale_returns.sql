-- Migration 051: Create sale_returns table (retur & penyesuaian harga)

DO $$ BEGIN
    CREATE TYPE return_type AS ENUM (
        'PRICE_REDUCTION',  -- Harga dikurangi (barang tidak kembali ke gudang)
        'PARTIAL_REFUND',   -- Dikembalikan uang sebagian (barang kembali sebagian)
        'FULL_REFUND'       -- Dikembalikan uang penuh (barang kembali semua)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS sale_returns (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id         UUID        NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    return_date     DATE        NOT NULL DEFAULT CURRENT_DATE,
    return_type     return_type NOT NULL,
    reason          TEXT        NOT NULL,  -- Wajib diisi
    qty_returned    DECIMAL(10,3) NOT NULL DEFAULT 0,  -- Qty fisik yg dikembalikan (0 jika hanya price reduction)
    amount_adjusted DECIMAL(14,2) NOT NULL,            -- Nilai yang dikurangi dari tagihan (selalu positif)
    restocked       BOOLEAN     NOT NULL DEFAULT FALSE, -- Barang fisik dikembalikan ke gudang?
    sale_item_id    UUID        REFERENCES sale_items(id) ON DELETE SET NULL, -- Item mana yang di-retur
    created_by      UUID        REFERENCES sys.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_return_amount_positive CHECK (amount_adjusted > 0),
    CONSTRAINT chk_return_qty_valid       CHECK (qty_returned >= 0)
);

CREATE INDEX IF NOT EXISTS idx_sale_returns_sale_id ON sale_returns(sale_id);

COMMENT ON TABLE sale_returns IS 'Rekaman retur dan penyesuaian harga. Mengurangi total_amount di nota';
COMMENT ON COLUMN sale_returns.restocked IS 'Jika TRUE, sistem menambah kembali stok ke inventory_items';
