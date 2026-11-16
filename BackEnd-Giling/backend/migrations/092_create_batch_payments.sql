-- Migration 092: Batch-level purchase debt (Hutang Pembelian per Batch)
-- Purchase payments are now made per batch from Batch Detail, in multiple installments.
-- Each installment is allocated FIFO into trx.purchase_payments so that
-- trx.purchases.paid_amount / payment_status (used by AP reports & Debt Manager) stay in sync.

-- 1. Batch payments (one row per installment, mirrors trx.sale_payments)
CREATE TABLE IF NOT EXISTS trx.batch_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES trx.batches(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount DECIMAL NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(50) DEFAULT 'CASH',
    reference_no VARCHAR(100),
    notes TEXT,
    bukti_nota_path TEXT,
    created_by UUID REFERENCES sys.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_batch_payments_batch_id ON trx.batch_payments(batch_id);

-- 2. Link per-purchase allocations to their batch installment
ALTER TABLE trx.purchase_payments
  ADD COLUMN IF NOT EXISTS batch_payment_id UUID REFERENCES trx.batch_payments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_purchase_payments_batch_payment_id ON trx.purchase_payments(batch_payment_id);

-- 3. Financial lock-date protection (same as other payment tables, see 070)
-- Guarded so the migration never fails on databases where 070 was skipped/modified.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'sys' AND p.proname = 'check_financial_lock'
    ) THEN
        DROP TRIGGER IF EXISTS trg_lock_batch_payments ON trx.batch_payments;
        CREATE TRIGGER trg_lock_batch_payments
        BEFORE INSERT OR UPDATE OR DELETE ON trx.batch_payments
        FOR EACH ROW
        EXECUTE FUNCTION sys.check_financial_lock();
    END IF;
END
$$;

-- 4. Cleanup: the Purchase Form used to create a PENDING 'PURCHASE' journal next to an
-- APPROVED duplicate. Those pending requests are obsolete (debt is now paid via batch payments).
UPDATE trx.journal_entries
SET status = 'REJECTED', updated_at = NOW()
WHERE reference_type = 'PURCHASE' AND status = 'PENDING';
