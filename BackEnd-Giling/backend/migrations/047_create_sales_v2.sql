-- Migration 047: Create sales V2 header table (trx.sales)
-- Nota Penjualan — satu nota bisa berisi banyak item, banyak delivery, banyak payment

DO $$ BEGIN
    CREATE TYPE sale_status AS ENUM (
        'DRAFT',             -- Nota sedang dibuat, stok belum dipotong
        'CONFIRMED',         -- Deal. Stok akan dipotong saat delivery
        'PARTIAL_DELIVERED', -- Sebagian barang sudah diambil
        'COMPLETED',         -- Semua barang sudah diambil
        'VOID'               -- Dibatalkan (soft delete, wajib ada void_reason)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM (
        'UNPAID',   -- Belum ada pembayaran
        'PARTIAL',  -- Sudah ada pembayaran sebagian
        'PAID'      -- Lunas
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS sales (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_no         VARCHAR(30)     UNIQUE,           -- Auto: 'JUAL/2026/05/001'
    customer_id     UUID            REFERENCES customers(id) ON DELETE SET NULL,
    sale_date       DATE            NOT NULL DEFAULT CURRENT_DATE,
    status          sale_status     NOT NULL DEFAULT 'DRAFT',
    payment_status  payment_status  NOT NULL DEFAULT 'UNPAID',

    -- Nilai finansial
    subtotal        DECIMAL(14,2)   NOT NULL DEFAULT 0,  -- Sum dari sale_items
    adjustment      DECIMAL(14,2)   NOT NULL DEFAULT 0,  -- Selisih dari retur (negatif = pengurangan)
    total_amount    DECIMAL(14,2)   NOT NULL DEFAULT 0,  -- subtotal + adjustment
    paid_amount     DECIMAL(14,2)   NOT NULL DEFAULT 0,  -- Total yg sudah dibayar
    outstanding     DECIMAL(14,2)   GENERATED ALWAYS AS (total_amount - paid_amount) STORED,

    notes           TEXT,
    void_reason     TEXT,                             -- WAJIB diisi jika VOID
    void_at         TIMESTAMPTZ,
    void_by         UUID            REFERENCES sys.users(id) ON DELETE SET NULL,

    created_by      UUID            REFERENCES sys.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    -- Validasi: void wajib ada alasan
    CONSTRAINT chk_void_has_reason CHECK (
        status != 'VOID' OR (void_reason IS NOT NULL AND void_reason != '')
    )
);

CREATE INDEX IF NOT EXISTS idx_sales_customer_id    ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date      ON sales(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_status         ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_payment_status ON sales(payment_status);
CREATE INDEX IF NOT EXISTS idx_sales_sale_no        ON sales(sale_no);

DROP TRIGGER IF EXISTS update_sales_updated_at ON sales;
CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE sales IS 'Header nota penjualan produk (beras, dedak, menir)';
COMMENT ON COLUMN sales.adjustment IS 'Nilai penyesuaian dari retur. Negatif = pengurangan tagihan';
COMMENT ON COLUMN sales.outstanding IS 'Sisa tagihan yang belum dibayar (computed column)';
