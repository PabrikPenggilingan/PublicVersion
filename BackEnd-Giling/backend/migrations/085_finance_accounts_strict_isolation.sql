-- Migration 085: Strict Finance Accounts Multi-Tenancy

-- 1. Add created_by to finance_accounts
ALTER TABLE trx.finance_accounts ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES sys.users(id);

-- 2. Modify constraint to be per-tenant
ALTER TABLE trx.finance_accounts DROP CONSTRAINT IF EXISTS unique_account_code;
ALTER TABLE trx.finance_accounts ADD CONSTRAINT unique_account_code_per_tenant UNIQUE (account_code, created_by);

-- 3. Assign existing accounts to an admin user (fallback)
-- Assuming we have at least one admin user
UPDATE trx.finance_accounts 
SET created_by = (SELECT id FROM sys.users WHERE role = 'admin' LIMIT 1)
WHERE created_by IS NULL;

-- 4. Seed default accounts for ALL users who don't have them
-- First, create a temporary function to do the seeding
CREATE OR REPLACE FUNCTION seed_finance_accounts_for_user(user_uuid UUID) RETURNS void AS $$
BEGIN
    INSERT INTO trx.finance_accounts (name, account_type, account_category, account_code, description, created_by) VALUES
    ('Kas Pabrik', 'CASH', 'ASSET', '1-100', 'Kas Utama', user_uuid),
    ('Modal Pemilik', 'CAPITAL', 'EQUITY', '3-100', 'Modal Awal', user_uuid),
    ('Pendapatan Penjualan Beras', 'SALES_REVENUE', 'REVENUE', '4-100', 'Penjualan Beras & Produk Turunan', user_uuid),
    ('Pendapatan Turunan & Limbah', 'OTHER_REVENUE', 'REVENUE', '4-200', 'Penjualan Dedak, Menir, Sekam', user_uuid),
    ('Piutang Pelanggan', 'RECEIVABLE', 'ASSET', '1-200', 'Piutang yang belum dibayar pelanggan', user_uuid),
    ('Persediaan (Stok Gudang)', 'INVENTORY', 'ASSET', '1-300', 'Nilai aset persediaan barang di gudang', user_uuid),
    ('Hutang Usaha (AP)', 'ACCOUNTS_PAYABLE', 'LIABILITY', '2-100', 'Hutang Pembelian Gabah ke Petani', user_uuid),
    ('Harga Pokok Penjualan (HPP)', 'COGS', 'EXPENSE', '5-100', 'Harga Pokok Beras yang Terjual', user_uuid),
    ('Beban Logistik', 'OPEX', 'EXPENSE', '5-200', 'Biaya Kuli Bongkar / Muat Truk', user_uuid),
    ('Beban Pengeringan', 'OPEX', 'EXPENSE', '5-300', 'Biaya Kuli & Operasional Penjemuran Gabah', user_uuid),
    ('Beban Penggilingan', 'OPEX', 'EXPENSE', '5-400', 'Biaya Solar, Operasional Mesin Giling', user_uuid),
    ('Beban Overhead Umum', 'OPEX', 'EXPENSE', '5-600', 'Pengeluaran Tak Terduga & Biaya Umum Pabrik', user_uuid)
    ON CONFLICT (account_code, created_by) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 5. Seed for existing users
DO $$
DECLARE
    u_id UUID;
BEGIN
    FOR u_id IN SELECT id FROM sys.users LOOP
        PERFORM seed_finance_accounts_for_user(u_id);
    END LOOP;
END;
$$;

-- 6. Trigger to auto-seed for new users
CREATE OR REPLACE FUNCTION trg_seed_finance_accounts() RETURNS trigger AS $$
BEGIN
    PERFORM seed_finance_accounts_for_user(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_seed_finance_accounts ON sys.users;
CREATE TRIGGER trigger_seed_finance_accounts
AFTER INSERT ON sys.users
FOR EACH ROW EXECUTE FUNCTION trg_seed_finance_accounts();
