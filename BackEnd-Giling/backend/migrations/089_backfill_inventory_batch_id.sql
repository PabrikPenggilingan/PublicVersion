-- Migration 089: Backfill batch_id on inventory items produced from milling processes
UPDATE trx.inventory_items ii
SET batch_id = COALESCE(input_ii.batch_id, pb.batch_id)
FROM trx.processes p
LEFT JOIN trx.inventory_items input_ii ON p.inventory_item_id = input_ii.id
LEFT JOIN trx.process_batches pb ON p.id = pb.process_id
WHERE ii.process_id = p.id 
  AND ii.batch_id IS NULL 
  AND COALESCE(input_ii.batch_id, pb.batch_id) IS NOT NULL;
