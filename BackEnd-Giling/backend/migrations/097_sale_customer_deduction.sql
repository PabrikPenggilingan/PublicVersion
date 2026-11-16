-- Migration 097: Potongan customer per nota (kuli bongkar, dll)
--
-- Some customers (toko besar) deduct costs such as kuli bongkar straight from what they
-- pay. The nota stays the official invoice (revenue = full nota); the deduction is our
-- expense and settles the rest of the receivable:
--   Dr 5-700 Beban Kuli Bongkar & Potongan Penjualan / Cr 1-200 Piutang Pelanggan
--
-- trx.sales.customer_deduction is entered as "Total Diterima dari Customer" (editable,
-- default = nota) and counts toward settlement: outstanding = total - paid - deduction,
-- and the nota is PAID once paid + deduction covers the total.
--
-- Idempotent: safe to run more than once.

-- 1. Columns
ALTER TABLE trx.sales
  ADD COLUMN IF NOT EXISTS customer_deduction DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deduction_note VARCHAR(255),
  ADD COLUMN IF NOT EXISTS deduction_journal_id UUID;

ALTER TABLE trx.sales DROP CONSTRAINT IF EXISTS chk_sales_customer_deduction_non_negative;
ALTER TABLE trx.sales
  ADD CONSTRAINT chk_sales_customer_deduction_non_negative CHECK (customer_deduction >= 0);

ALTER TABLE trx.sales DROP CONSTRAINT IF EXISTS sales_deduction_journal_id_fkey;
ALTER TABLE trx.sales
  ADD CONSTRAINT sales_deduction_journal_id_fkey
  FOREIGN KEY (deduction_journal_id) REFERENCES trx.journal_entries(id) ON DELETE SET NULL;

COMMENT ON COLUMN trx.sales.customer_deduction IS
  'Potongan yang dipotong langsung oleh customer (kuli bongkar, dll). Beban pabrik; mengurangi sisa tagihan, bukan nilai nota.';

-- 2. outstanding = total - paid - deduction.
--    A generated column's expression can't be changed in place on every Postgres version,
--    so the bridge view public.sales (054) is dropped and rebuilt around it.
DO $$
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'trx' AND table_name = 'sales' AND column_name = 'outstanding'
        AND generation_expression ILIKE '%customer_deduction%'
  ) THEN
    DROP VIEW IF EXISTS public.sales;
    ALTER TABLE trx.sales DROP COLUMN IF EXISTS outstanding;
    ALTER TABLE trx.sales
      ADD COLUMN outstanding DECIMAL(14,2)
      GENERATED ALWAYS AS (total_amount - paid_amount - customer_deduction) STORED;
  END IF;
END $$;

CREATE OR REPLACE VIEW public.sales AS
SELECT id, sale_no, customer_id, sale_date, status, payment_status, subtotal, adjustment,
       total_amount, paid_amount, outstanding, notes, void_reason, void_at, void_by,
       created_by, created_at, updated_at, customer_deduction, deduction_note, deduction_journal_id
FROM trx.sales;

COMMENT ON VIEW public.sales IS 'Bridge view → trx.sales';

-- Insert through the bridge view by column name (the table's column order changed)
CREATE OR REPLACE FUNCTION public.sales_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO trx.sales (id, sale_no, customer_id, sale_date, status, payment_status, subtotal, adjustment,
                         total_amount, paid_amount, notes, void_reason, void_at, void_by, created_by,
                         created_at, updated_at, customer_deduction, deduction_note, deduction_journal_id)
  VALUES (COALESCE(NEW.id, gen_random_uuid()), NEW.sale_no, NEW.customer_id, COALESCE(NEW.sale_date, CURRENT_DATE),
          COALESCE(NEW.status, 'DRAFT'), COALESCE(NEW.payment_status, 'UNPAID'), COALESCE(NEW.subtotal, 0),
          COALESCE(NEW.adjustment, 0), COALESCE(NEW.total_amount, 0), COALESCE(NEW.paid_amount, 0), NEW.notes,
          NEW.void_reason, NEW.void_at, NEW.void_by, NEW.created_by, COALESCE(NEW.created_at, now()),
          COALESCE(NEW.updated_at, now()), COALESCE(NEW.customer_deduction, 0), NEW.deduction_note,
          NEW.deduction_journal_id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS sales_v2_insert ON public.sales;
DROP TRIGGER IF EXISTS sales_v2_update ON public.sales;
DROP TRIGGER IF EXISTS sales_v2_delete ON public.sales;
CREATE TRIGGER sales_v2_insert INSTEAD OF INSERT ON public.sales FOR EACH ROW EXECUTE FUNCTION public.sales_insert();
CREATE TRIGGER sales_v2_update INSTEAD OF UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.sales_update();
CREATE TRIGGER sales_v2_delete INSTEAD OF DELETE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.sales_delete();

-- Same hardening as 094 for the rebuilt view
DO $$
BEGIN
  IF current_setting('server_version_num')::int >= 150000 THEN
    ALTER VIEW public.sales SET (security_invoker = true);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.sales FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.sales FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gabah_app_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO gabah_app_user;
  END IF;
END $$;

-- 3. payment_status counts the deduction. The existing sync triggers (052) set the status
--    from paid vs total; this BEFORE trigger runs on their UPDATE and has the final say.
CREATE OR REPLACE FUNCTION trx.apply_sale_payment_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_settled DECIMAL(14,2) := COALESCE(NEW.paid_amount, 0) + COALESCE(NEW.customer_deduction, 0);
BEGIN
    IF COALESCE(NEW.paid_amount, 0) <= 0 AND COALESCE(NEW.customer_deduction, 0) <= 0 THEN
        NEW.payment_status := 'UNPAID';
    ELSIF v_settled >= COALESCE(NEW.total_amount, 0) THEN
        NEW.payment_status := 'PAID';
    ELSE
        NEW.payment_status := 'PARTIAL';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_sale_payment_status ON trx.sales;
CREATE TRIGGER trg_apply_sale_payment_status
    BEFORE INSERT OR UPDATE OF paid_amount, total_amount, customer_deduction, payment_status ON trx.sales
    FOR EACH ROW EXECUTE FUNCTION trx.apply_sale_payment_status();

-- 4. Expense account
INSERT INTO trx.finance_accounts (name, account_type, account_category, account_code, description, created_by)
SELECT 'Beban Kuli Bongkar & Potongan Penjualan', 'OPEX', 'EXPENSE', '5-700',
       'Potongan yang dipotong customer dari pembayaran nota (kuli bongkar, dll)',
       (SELECT created_by FROM trx.finance_accounts WHERE account_code = '5-200' LIMIT 1)
ON CONFLICT (account_code) DO NOTHING;
