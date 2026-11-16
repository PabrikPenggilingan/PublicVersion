-- Migration 067: Finance Draft & Approve Architecture
-- Adds status column to finance_transactions and approval tracking

-- 1. Add status to finance_transactions
--    PENDING = awaiting Finance Manager approval (does NOT affect account balances)
--    APPROVED = confirmed, already applied to account balances
--    REJECTED = declined, no effect on balances
ALTER TABLE trx.finance_transactions
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'APPROVED',
    ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES sys.users(id),
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS pending_account_id UUID REFERENCES trx.finance_accounts(id),
    ADD COLUMN IF NOT EXISTS source_module VARCHAR(50),
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 2. Add check constraint on status values
ALTER TABLE trx.finance_transactions
    DROP CONSTRAINT IF EXISTS chk_finance_tx_status;
ALTER TABLE trx.finance_transactions
    ADD CONSTRAINT chk_finance_tx_status
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'));

-- 3. Index for quick lookup of pending transactions (for Approval Center UI)
CREATE INDEX IF NOT EXISTS idx_finance_tx_status
    ON trx.finance_transactions (status)
    WHERE status = 'PENDING';

-- 4. Add account_id requirement note:
--    When status = 'PENDING', account_id can be NULL (account not yet chosen)
--    When status = 'APPROVED', account_id MUST be set (chosen by Finance Manager)
ALTER TABLE trx.finance_transactions
    ALTER COLUMN account_id DROP NOT NULL;
