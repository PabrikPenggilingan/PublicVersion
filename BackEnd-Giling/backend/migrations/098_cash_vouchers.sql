-- Migration 098: Bukti Kas (bayar / terima sekaligus)
--
-- The owner can pay (or receive) several pending transactions in one go, e.g. transport +
-- komisi calo of one truck plus a purchase's kuli cost. Each transaction keeps its own
-- journal and expense account (laporan tetap terpisah per jenis biaya); the voucher only
-- groups them as one cash movement with one number:
--   BKK/2026/11/001  (Bukti Kas Keluar)   or   BKM/2026/11/001  (Bukti Kas Masuk)
-- Each item records the cash/bank account it was paid from, so one voucher may mix accounts.
--
-- Idempotent: safe to run more than once.

CREATE TABLE IF NOT EXISTS trx.cash_vouchers (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_no    VARCHAR(50) NOT NULL,
    voucher_type  VARCHAR(3)  NOT NULL,
    voucher_date  DATE        NOT NULL DEFAULT CURRENT_DATE,
    total_amount  DECIMAL(14,2) NOT NULL DEFAULT 0,
    notes         VARCHAR(500),
    created_by    UUID REFERENCES sys.users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_cash_vouchers_no UNIQUE (voucher_no),
    CONSTRAINT chk_cash_vouchers_type CHECK (voucher_type IN ('OUT', 'IN')),
    CONSTRAINT chk_cash_vouchers_total CHECK (total_amount >= 0)
);

CREATE TABLE IF NOT EXISTS trx.cash_voucher_items (
    voucher_id  UUID NOT NULL REFERENCES trx.cash_vouchers(id) ON DELETE CASCADE,
    journal_id  UUID NOT NULL REFERENCES trx.journal_entries(id) ON DELETE CASCADE,
    account_id  UUID REFERENCES trx.finance_accounts(id) ON DELETE SET NULL,
    amount      DECIMAL(14,2) NOT NULL DEFAULT 0,
    PRIMARY KEY (voucher_id, journal_id),
    CONSTRAINT uq_cash_voucher_items_journal UNIQUE (journal_id)
);

CREATE INDEX IF NOT EXISTS idx_cash_vouchers_date ON trx.cash_vouchers (voucher_date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_vouchers_created_by ON trx.cash_vouchers (created_by);

COMMENT ON TABLE trx.cash_vouchers IS
  'Bukti kas keluar/masuk: beberapa transaksi dibayar/diterima sekaligus. Jurnal tiap transaksi tetap terpisah.';

ALTER TABLE trx.cash_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trx.cash_voucher_items ENABLE ROW LEVEL SECURITY;
