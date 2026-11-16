-- Migration 060: Update inventory_transactions transaction_type constraint
-- Add RESERVED and UNRESERVED types for milling/drying reservation flow

-- 1. Drop existing constraint
ALTER TABLE trx.inventory_transactions DROP CONSTRAINT IF EXISTS inventory_transactions_transaction_type_check;

-- 2. Add new constraint with additional types
ALTER TABLE trx.inventory_transactions 
ADD CONSTRAINT inventory_transactions_transaction_type_check 
CHECK (transaction_type IN ('IN', 'OUT', 'ADJUST', 'RESERVED', 'UNRESERVED'));

COMMENT ON COLUMN trx.inventory_transactions.transaction_type IS 'IN, OUT, ADJUST, RESERVED, UNRESERVED';
