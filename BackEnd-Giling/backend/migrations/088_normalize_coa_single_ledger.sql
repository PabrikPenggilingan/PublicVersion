-- Migration 088: Normalize Chart of Accounts to Single Factory Ledger

-- 1. Drop trigger and functions that auto-seeded duplicate accounts for each user
DROP TRIGGER IF EXISTS trigger_seed_finance_accounts ON sys.users;
DROP FUNCTION IF EXISTS trg_seed_finance_accounts();
DROP FUNCTION IF EXISTS seed_finance_accounts_for_user(UUID);

-- 2. Consolidate duplicate accounts to a single primary account per account_code
DO $$
DECLARE
    r RECORD;
    v_primary_id UUID;
BEGIN
    FOR r IN SELECT DISTINCT account_code FROM trx.finance_accounts
    LOOP
        -- Find primary account (admin's account or earliest created)
        SELECT id INTO v_primary_id 
        FROM trx.finance_accounts 
        WHERE account_code = r.account_code 
        ORDER BY 
            CASE WHEN created_by = (SELECT id FROM sys.users WHERE role = 'admin' LIMIT 1) THEN 0 ELSE 1 END,
            created_at ASC 
        LIMIT 1;

        -- Relink any journal lines that might point to duplicate accounts
        UPDATE trx.journal_lines
        SET account_id = v_primary_id
        WHERE account_id IN (
            SELECT id FROM trx.finance_accounts 
            WHERE account_code = r.account_code AND id != v_primary_id
        );

        -- Delete duplicate accounts
        DELETE FROM trx.finance_accounts
        WHERE account_code = r.account_code AND id != v_primary_id;
    END LOOP;
END $$;

-- 3. Restore global unique constraint on account_code
ALTER TABLE trx.finance_accounts DROP CONSTRAINT IF EXISTS unique_account_code_per_tenant;
ALTER TABLE trx.finance_accounts DROP CONSTRAINT IF EXISTS unique_account_code;
ALTER TABLE trx.finance_accounts ADD CONSTRAINT unique_account_code UNIQUE (account_code);
