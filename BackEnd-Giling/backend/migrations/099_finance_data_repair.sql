-- Migration 099: Perbaikan data keuangan
--
-- 1. Rekening kas/bank yang dibuat tanpa kategori tidak muncul di pilihan rekening
--    Approval dan Buku Besar (keduanya memfilter kategori ASSET). Beri kategori sesuai tipenya.
-- 2. Jurnal pembalik (VOID) dari hapus pembelian / hapus biaya giling dulu dibuat tanpa
--    pemilik (created_by NULL), sehingga tidak terhitung di saldo & laporan pemilik datanya.
--    Ambil pemilik dari jurnal yang dibaliknya.
--
-- Idempotent: safe to run more than once.

UPDATE trx.finance_accounts
SET account_category = CASE
        WHEN UPPER(account_type) IN ('CASH', 'BANK', 'RECEIVABLE', 'INVENTORY') THEN 'ASSET'
        WHEN UPPER(account_type) IN ('ACCOUNTS_PAYABLE', 'LIABILITY') THEN 'LIABILITY'
        WHEN UPPER(account_type) IN ('CAPITAL', 'EQUITY') THEN 'EQUITY'
        WHEN UPPER(account_type) LIKE '%REVENUE' THEN 'REVENUE'
        WHEN UPPER(account_type) IN ('COGS', 'OPEX', 'EXPENSE') THEN 'EXPENSE'
    END
WHERE account_category IS NULL
  AND (UPPER(account_type) IN ('CASH', 'BANK', 'RECEIVABLE', 'INVENTORY', 'ACCOUNTS_PAYABLE', 'LIABILITY',
                               'CAPITAL', 'EQUITY', 'COGS', 'OPEX', 'EXPENSE')
       OR UPPER(account_type) LIKE '%REVENUE');

UPDATE trx.journal_entries v
SET created_by = o.created_by
FROM trx.journal_entries o
WHERE v.reference_type = 'VOID'
  AND v.created_by IS NULL
  AND v.reference_id = o.id
  AND o.created_by IS NOT NULL;
