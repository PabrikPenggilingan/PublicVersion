-- Migration 095: "Harga sampai tempat" (delivered price) for purchases
--
-- The field buyer often pays the seller a delivered price that already
-- includes transport. trx.purchases.total_harga stays the goods value
-- (harga_per_kg × berat) and keeps driving debt, inventory and HPP. The amount
-- actually paid is stored in total_dibayar; the batch transport cost is suggested
-- from SUM(total_dibayar - total_harga) and stays editable in the Logistik step.
--
-- Idempotent: safe to run more than once.

-- 1. Purchases: amount actually paid (NULL = same as total_harga)
ALTER TABLE trx.purchases
  ADD COLUMN IF NOT EXISTS total_dibayar DECIMAL(14,2);

ALTER TABLE trx.purchases DROP CONSTRAINT IF EXISTS chk_purchases_total_dibayar_non_negative;
ALTER TABLE trx.purchases
  ADD CONSTRAINT chk_purchases_total_dibayar_non_negative CHECK (total_dibayar IS NULL OR total_dibayar >= 0);

COMMENT ON COLUMN trx.purchases.total_dibayar IS
  'Total uang yang benar-benar dibayar ke penjual (harga sampai tempat, termasuk transport). NULL = sama dengan total_harga.';
