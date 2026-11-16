-- Migration 072: Jurnal Berpasangan (Double-Entry Ledger)

-- 1. Create Journal Header Table
CREATE TABLE IF NOT EXISTS trx.journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reference_type VARCHAR(50) NOT NULL, -- 'SALE', 'PURCHASE', 'OVERHEAD', 'MANUAL'
    reference_id UUID,
    description TEXT,
    status VARCHAR(20) DEFAULT 'APPROVED', -- 'PENDING', 'APPROVED', 'REJECTED'
    created_by UUID REFERENCES sys.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create Journal Lines Table (Debit/Credit)
CREATE TABLE IF NOT EXISTS trx.journal_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_id UUID NOT NULL REFERENCES trx.journal_entries(id) ON DELETE CASCADE,
    account_id UUID REFERENCES trx.finance_accounts(id), -- Nullable for PENDING transactions waiting for Cash account assignment
    debit DECIMAL DEFAULT 0,
    credit DECIMAL DEFAULT 0,
    CHECK (debit >= 0 AND credit >= 0),
    CHECK (debit > 0 OR credit > 0)
);

-- 3. Migrate historical data from single-entry to double-entry
DO $$
DECLARE
    rec RECORD;
    v_journal_id UUID;
    v_contra_account_id UUID;
BEGIN
    FOR rec IN SELECT * FROM trx.finance_transactions ORDER BY transaction_date ASC
    LOOP
        -- Determine the contra account based on legacy 'category'
        IF rec.category = 'SALE' THEN
            SELECT id INTO v_contra_account_id FROM trx.finance_accounts WHERE account_code = '4-100' LIMIT 1;
        ELSIF rec.category = 'PURCHASE' THEN
            SELECT id INTO v_contra_account_id FROM trx.finance_accounts WHERE account_code = '1-300' LIMIT 1; -- Asumsi masuk ke Inventory
        ELSIF rec.category = 'OVERHEAD' THEN
            SELECT id INTO v_contra_account_id FROM trx.finance_accounts WHERE account_code = '5-600' LIMIT 1; -- Overhead Umum
        ELSE
            SELECT id INTO v_contra_account_id FROM trx.finance_accounts WHERE account_code = '5-600' LIMIT 1;
        END IF;

        -- Fallback if contra account somehow not found (shouldn't happen if 071 ran correctly)
        IF v_contra_account_id IS NULL THEN
            CONTINUE;
        END IF;

        -- Create Journal Header
        INSERT INTO trx.journal_entries (transaction_date, reference_type, reference_id, description, status, created_by, created_at)
        VALUES (DATE(rec.transaction_date), rec.category, rec.reference_id, rec.description, 
                COALESCE(rec.status, 'APPROVED'), rec.created_by, rec.transaction_date)
        RETURNING id INTO v_journal_id;

        -- Create Journal Lines based on IN/OUT
        IF rec.transaction_type = 'IN' THEN
            -- Uang masuk: Debit Kas (account_id), Kredit Lawan (Pendapatan)
            INSERT INTO trx.journal_lines (journal_id, account_id, debit, credit) VALUES (v_journal_id, rec.account_id, rec.amount, 0);
            INSERT INTO trx.journal_lines (journal_id, account_id, debit, credit) VALUES (v_journal_id, v_contra_account_id, 0, rec.amount);
        ELSE
            -- Uang keluar: Debit Lawan (Biaya/Aset), Kredit Kas (account_id)
            INSERT INTO trx.journal_lines (journal_id, account_id, debit, credit) VALUES (v_journal_id, v_contra_account_id, rec.amount, 0);
            INSERT INTO trx.journal_lines (journal_id, account_id, debit, credit) VALUES (v_journal_id, rec.account_id, 0, rec.amount);
        END IF;
    END LOOP;
END
$$;

-- 4. Set Trigger Lock Date for Journal Entries
DROP TRIGGER IF EXISTS trg_lock_journal_entries ON trx.journal_entries;
CREATE TRIGGER trg_lock_journal_entries
BEFORE INSERT OR UPDATE OR DELETE ON trx.journal_entries
FOR EACH ROW
EXECUTE FUNCTION sys.check_financial_lock();
