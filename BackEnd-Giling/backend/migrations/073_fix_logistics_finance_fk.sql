-- Migration 073: Fix Logistics Finance Transaction FK
-- Drop the old constraint referencing finance_transactions and point it to journal_entries

ALTER TABLE trx.logistics_tasks
  DROP CONSTRAINT IF EXISTS logistics_tasks_finance_transaction_id_fkey;

-- Cleanup invalid references first
UPDATE trx.logistics_tasks 
SET finance_transaction_id = NULL 
WHERE finance_transaction_id IS NOT NULL 
AND finance_transaction_id NOT IN (SELECT id FROM trx.journal_entries);

ALTER TABLE trx.logistics_tasks
  ADD CONSTRAINT logistics_tasks_finance_transaction_id_fkey
  FOREIGN KEY (finance_transaction_id) REFERENCES trx.journal_entries(id)
  ON DELETE SET NULL;
