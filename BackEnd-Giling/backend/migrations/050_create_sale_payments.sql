-- Migration 050: Create sale_payments table (multi-payment, multi-method)

DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM (
        'CASH',
        'TRANSFER',
        'GIRO',
        'CEK',
        'OTHER'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS sale_payments (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id         UUID            NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    payment_date    DATE            NOT NULL DEFAULT CURRENT_DATE,
    amount          DECIMAL(14,2)   NOT NULL,
    method          payment_method  NOT NULL DEFAULT 'CASH',
    reference_no    VARCHAR(100),   -- No. referensi transfer / nomor cek / giro
    notes           TEXT,
    created_by      UUID            REFERENCES sys.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_payment_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_sale_payments_sale_id      ON sale_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_payment_date ON sale_payments(payment_date DESC);

COMMENT ON TABLE sale_payments IS 'Rekaman pembayaran masuk per nota. Boleh multi-payment dan multi-metode';
