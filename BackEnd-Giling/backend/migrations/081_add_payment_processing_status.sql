-- Migration 081: Add PAYMENT_PROCESSING to inventory_items status
ALTER TABLE trx.inventory_items DROP CONSTRAINT IF EXISTS inventory_items_status_check;
ALTER TABLE trx.inventory_items ADD CONSTRAINT inventory_items_status_check CHECK (status IN ('AVAILABLE', 'RESERVED', 'DEPLETED', 'PAYMENT_PROCESSING'));
