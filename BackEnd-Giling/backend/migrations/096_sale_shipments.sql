-- Migration 096: Pengiriman penjualan (1 mobil = 1 pengiriman, bisa banyak nota)
--
-- A sales logistics task (reference_type = 'SALE') becomes a shipment that can carry
-- several nota (trx.logistics_task_sales). Besides the transport cost (5-200 Beban
-- Logistik) it records the broker commission paid by the factory, calculated per
-- tonnage (commission_rate_per_kg × total kg in the truck, total stays editable),
-- posted to the new account 5-500 Beban Komisi Calo. The nota itself stays the
-- official invoice: the customer pays the full nota, both costs are our expenses.
--
-- Also removes the "ongkos kirim ditagih ke customer" (trx.sales.transport_charge)
-- experiment: it never shipped, the customer never pays transport.
--
-- Idempotent: safe to run more than once.

-- 1. Remove the delivery-fee-on-invoice experiment (no-op where it never existed)
DROP TRIGGER IF EXISTS trg_apply_sale_transport_charge ON trx.sales;
DROP FUNCTION IF EXISTS trx.apply_sale_transport_charge();
ALTER TABLE trx.sales DROP CONSTRAINT IF EXISTS chk_sales_transport_charge_non_negative;
ALTER TABLE trx.sales DROP COLUMN IF EXISTS transport_charge;

-- 2. Shipment fields on logistics tasks
ALTER TABLE trx.logistics_tasks
  ADD COLUMN IF NOT EXISTS shipment_date DATE,
  ADD COLUMN IF NOT EXISTS commission_rate_per_kg DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_recipient VARCHAR(255),
  ADD COLUMN IF NOT EXISTS commission_transaction_id UUID;

ALTER TABLE trx.logistics_tasks DROP CONSTRAINT IF EXISTS logistics_tasks_commission_transaction_id_fkey;
ALTER TABLE trx.logistics_tasks
  ADD CONSTRAINT logistics_tasks_commission_transaction_id_fkey
  FOREIGN KEY (commission_transaction_id) REFERENCES trx.journal_entries(id) ON DELETE SET NULL;

ALTER TABLE trx.logistics_tasks DROP CONSTRAINT IF EXISTS chk_logistics_commission_non_negative;
ALTER TABLE trx.logistics_tasks
  ADD CONSTRAINT chk_logistics_commission_non_negative
  CHECK (commission_rate_per_kg >= 0 AND commission_amount >= 0);

COMMENT ON COLUMN trx.logistics_tasks.commission_rate_per_kg IS 'Tarif komisi calo per kg (penjualan).';
COMMENT ON COLUMN trx.logistics_tasks.commission_amount IS 'Total komisi calo yang dibayar pabrik untuk pengiriman ini.';

-- 3. Nota carried by a sales shipment (a nota belongs to at most one shipment)
CREATE TABLE IF NOT EXISTS trx.logistics_task_sales (
    logistics_task_id UUID NOT NULL REFERENCES trx.logistics_tasks(id) ON DELETE CASCADE,
    sale_id           UUID NOT NULL REFERENCES trx.sales(id) ON DELETE CASCADE,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (logistics_task_id, sale_id),
    CONSTRAINT uq_logistics_task_sales_sale UNIQUE (sale_id)
);
ALTER TABLE trx.logistics_task_sales ENABLE ROW LEVEL SECURITY;

-- Existing single-nota sales transports become one-nota shipments
INSERT INTO trx.logistics_task_sales (logistics_task_id, sale_id)
SELECT lt.id, lt.reference_id
FROM trx.logistics_tasks lt
JOIN trx.sales s ON s.id = lt.reference_id
WHERE lt.reference_type = 'SALE'
ON CONFLICT DO NOTHING;

UPDATE trx.logistics_tasks lt
SET shipment_date = COALESCE(lt.shipment_date, s.sale_date::date, lt.created_at::date)
FROM trx.sales s
WHERE lt.reference_type = 'SALE' AND s.id = lt.reference_id AND lt.shipment_date IS NULL;

-- 4. Expense account for broker commission (single factory ledger)
INSERT INTO trx.finance_accounts (name, account_type, account_category, account_code, description, created_by)
SELECT 'Beban Komisi Calo', 'OPEX', 'EXPENSE', '5-500',
       'Komisi makelar/calo penjualan (dihitung per tonase)',
       (SELECT created_by FROM trx.finance_accounts WHERE account_code = '5-200' LIMIT 1)
ON CONFLICT (account_code) DO NOTHING;

-- Nama supir opsional untuk pengiriman (sering belum diketahui saat dicatat)
ALTER TABLE trx.logistics_tasks ALTER COLUMN driver_name DROP NOT NULL;
