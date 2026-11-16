-- Migration 087: Add bukti_nota_path to sale_payments

ALTER TABLE trx.sale_payments ADD COLUMN IF NOT EXISTS bukti_nota_path VARCHAR(500);
