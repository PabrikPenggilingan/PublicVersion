-- Migration 048: Create sale_items table (line items per nota)

DO $$ BEGIN
    CREATE TYPE sale_unit_type AS ENUM ('KG', 'SACK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS sale_items (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id             UUID            NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    inventory_item_id   UUID            REFERENCES trx.inventory_items(id) ON DELETE SET NULL,

    -- Snapshot data saat nota dibuat (immutable setelah CONFIRMED)
    item_name           VARCHAR(255)    NOT NULL,   -- Snapshot: "Beras IR64 25kg"
    category_code       VARCHAR(20)     NOT NULL,   -- Snapshot: 'BERAS', 'DEDAK', 'MENIR'
    unit_type           sale_unit_type  NOT NULL,   -- KG atau SACK
    hpp_per_unit        DECIMAL(12,2),              -- Snapshot HPP (hanya terlihat Admin)

    -- Harga & Qty
    unit_price          DECIMAL(12,2)   NOT NULL,   -- Harga jual per unit (Kg atau Sack)
    qty_ordered         DECIMAL(10,3)   NOT NULL,   -- Qty yg di-deal
    qty_delivered       DECIMAL(10,3)   NOT NULL DEFAULT 0, -- Qty yg sudah keluar gudang
    subtotal            DECIMAL(14,2)   GENERATED ALWAYS AS (unit_price * qty_ordered) STORED,

    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_qty_ordered_positive   CHECK (qty_ordered > 0),
    CONSTRAINT chk_unit_price_positive    CHECK (unit_price > 0),
    CONSTRAINT chk_qty_delivered_valid    CHECK (qty_delivered >= 0 AND qty_delivered <= qty_ordered)
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id            ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_inventory_item_id  ON sale_items(inventory_item_id);

COMMENT ON TABLE sale_items IS 'Line item produk dalam satu nota penjualan';
COMMENT ON COLUMN sale_items.hpp_per_unit IS 'Snapshot HPP dari proses giling. Digunakan untuk laporan margin keuntungan (Admin only)';
COMMENT ON COLUMN sale_items.qty_delivered IS 'Diupdate setiap kali ada delivery record. Harus <= qty_ordered';
