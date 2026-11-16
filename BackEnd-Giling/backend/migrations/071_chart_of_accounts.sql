-- Migration 071: Chart of Accounts (CoA) Upgrades

-- 1. Add new columns for CoA structure
ALTER TABLE trx.finance_accounts ADD COLUMN IF NOT EXISTS account_category VARCHAR(50); -- 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'
ALTER TABLE trx.finance_accounts ADD COLUMN IF NOT EXISTS account_code VARCHAR(20);
ALTER TABLE trx.finance_accounts ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. Add Unique constraint on account_code so we can safely upsert
-- Need to handle existing nulls: postgres allows multiple nulls in unique constraints.
ALTER TABLE trx.finance_accounts ADD CONSTRAINT unique_account_code UNIQUE (account_code);

-- 3. Update existing accounts created in older migrations
UPDATE trx.finance_accounts 
SET account_category = 'ASSET', account_code = '1-100'
WHERE name = 'Kas Pabrik' AND account_code IS NULL;

UPDATE trx.finance_accounts 
SET account_category = 'EQUITY', account_code = '3-100'
WHERE name = 'Modal Pemilik' AND account_code IS NULL;

-- 4. Insert Default Chart of Accounts based on accounting.map.js
INSERT INTO trx.finance_accounts (name, account_type, account_category, account_code, description) VALUES
('Pendapatan Penjualan Beras', 'SALES_REVENUE', 'REVENUE', '4-100', 'Penjualan Beras & Produk Turunan'),
('Pendapatan Turunan & Limbah', 'OTHER_REVENUE', 'REVENUE', '4-200', 'Penjualan Dedak, Menir, Sekam'),
('Piutang Pelanggan', 'RECEIVABLE', 'ASSET', '1-200', 'Piutang yang belum dibayar pelanggan'),
('Persediaan (Stok Gudang)', 'INVENTORY', 'ASSET', '1-300', 'Nilai aset persediaan barang di gudang'),
('Hutang Usaha (AP)', 'ACCOUNTS_PAYABLE', 'LIABILITY', '2-100', 'Hutang Pembelian Gabah ke Petani'),
('Harga Pokok Penjualan (HPP)', 'COGS', 'EXPENSE', '5-100', 'Harga Pokok Beras yang Terjual'),
('Beban Logistik', 'OPEX', 'EXPENSE', '5-200', 'Biaya Kuli Bongkar / Muat Truk'),
('Beban Pengeringan', 'OPEX', 'EXPENSE', '5-300', 'Biaya Kuli & Operasional Penjemuran Gabah'),
('Beban Penggilingan', 'OPEX', 'EXPENSE', '5-400', 'Biaya Solar, Operasional Mesin Giling'),
('Beban Overhead Umum', 'OPEX', 'EXPENSE', '5-600', 'Pengeluaran Tak Terduga & Biaya Umum Pabrik')
ON CONFLICT (account_code) DO NOTHING;
