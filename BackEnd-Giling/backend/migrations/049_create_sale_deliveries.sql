-- Migration 049: Create sale_deliveries table (pengambilan barang bertahap)
-- Setiap record = 1 kali pengambilan fisik. Stok dipotong saat delivery dicatat.

CREATE TABLE IF NOT EXISTS sale_deliveries (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id         UUID        NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    delivery_date   DATE        NOT NULL DEFAULT CURRENT_DATE,
    notes           TEXT,       -- "Diambil sopir Pak Budi, Nopol B 1234 AB"
    created_by      UUID        REFERENCES sys.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Detail per item dalam satu pengambilan
CREATE TABLE IF NOT EXISTS sale_delivery_items (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id         UUID        NOT NULL REFERENCES sale_deliveries(id) ON DELETE CASCADE,
    sale_item_id        UUID        NOT NULL REFERENCES sale_items(id) ON DELETE CASCADE,
    qty_delivered       DECIMAL(10,3) NOT NULL,

    CONSTRAINT chk_delivery_qty_positive CHECK (qty_delivered > 0)
);

CREATE INDEX IF NOT EXISTS idx_sale_deliveries_sale_id  ON sale_deliveries(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_delivery_items_del  ON sale_delivery_items(delivery_id);
CREATE INDEX IF NOT EXISTS idx_sale_delivery_items_item ON sale_delivery_items(sale_item_id);

COMMENT ON TABLE sale_deliveries IS 'Rekaman pengambilan fisik barang oleh buyer (bisa bertahap)';
COMMENT ON TABLE sale_delivery_items IS 'Detail qty per item dalam satu pengambilan';
