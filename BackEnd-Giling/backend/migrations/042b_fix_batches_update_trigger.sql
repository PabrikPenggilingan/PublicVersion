-- Migration 042: Fix batches INSTEAD OF UPDATE trigger

CREATE OR REPLACE FUNCTION public.batches_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE trx.batches
    SET batch_date   = NEW.batch_date,
        status       = NEW.status,
        total_qty_kg = NEW.total_qty_kg,
        remaining_kg = NEW.remaining_kg,
        is_active    = NEW.is_active,
        created_by   = NEW.created_by,
        updated_at   = NEW.updated_at
    WHERE id = OLD.id;
    RETURN NEW;
END; $$;

-- Recalculate total_qty_kg and remaining_kg for all batches affected by the bug
UPDATE trx.batches b
SET 
    total_qty_kg = COALESCE((SELECT SUM(berat_gabah_kg) FROM trx.purchases p WHERE p.batch_id = b.id), 0),
    remaining_kg = COALESCE((SELECT SUM(berat_gabah_kg) FROM trx.purchases p WHERE p.batch_id = b.id), 0) 
                 - COALESCE((SELECT SUM(qty_used_kg) FROM process_batches pb WHERE pb.batch_id = b.id), 0);

-- Re-open batches that were incorrectly closed by the auto_close_batch trigger
-- We re-open them if they have remaining_kg > 0 AND they do not have a batch_completions record
UPDATE trx.batches b
SET status = 'OPEN'
WHERE status = 'CLOSED' 
  AND remaining_kg > 0 
  AND NOT EXISTS (SELECT 1 FROM trx.batch_completions bc WHERE bc.batch_id = b.id);
