-- Migration 041: Add process_id to inventory_items
-- Adds support for routing milling outputs directly to the warehouse

-- 1. Add process_id to the base table in trx schema
ALTER TABLE trx.inventory_items ADD COLUMN process_id UUID REFERENCES trx.processes(id) ON DELETE SET NULL;

-- 2. Update source_type constraint to allow 'process'
ALTER TABLE trx.inventory_items DROP CONSTRAINT IF EXISTS inventory_items_source_type_check;
ALTER TABLE trx.inventory_items ADD CONSTRAINT inventory_items_source_type_check CHECK (source_type IN ('batch', 'drying', 'process'));

-- 3. Update the view bridge in public schema to include process_id
-- We must drop the view and recreate it, which also means we must recreate the triggers attached to it.
DROP VIEW IF EXISTS public.inventory_items CASCADE;

CREATE VIEW public.inventory_items AS SELECT * FROM trx.inventory_items;

-- 4. Recreate the INSTEAD OF triggers for public.inventory_items
CREATE OR REPLACE FUNCTION public.inventory_items_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN INSERT INTO trx.inventory_items VALUES (NEW.*); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.inventory_items_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE trx.inventory_items
    SET source_type           = NEW.source_type,
        batch_id              = NEW.batch_id,
        drying_id             = NEW.drying_id,
        process_id            = NEW.process_id,
        product_category_code = NEW.product_category_code,
        area                  = NEW.area,
        tanda                 = NEW.tanda,
        kualitas              = NEW.kualitas,
        avg_price_per_kg      = NEW.avg_price_per_kg,
        total_weight_kg       = NEW.total_weight_kg,
        remaining_weight_kg   = NEW.remaining_weight_kg,
        total_sacks           = NEW.total_sacks,
        remaining_sacks       = NEW.remaining_sacks,
        status                = NEW.status,
        entry_date            = NEW.entry_date,
        notes                 = NEW.notes,
        created_by            = NEW.created_by,
        created_at            = NEW.created_at,
        updated_at            = NEW.updated_at
    WHERE id = OLD.id;
    RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.inventory_items_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM trx.inventory_items WHERE id = OLD.id; RETURN OLD; END; $$;

CREATE TRIGGER inventory_items_insert INSTEAD OF INSERT ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.inventory_items_insert();
CREATE TRIGGER inventory_items_update INSTEAD OF UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.inventory_items_update();
CREATE TRIGGER inventory_items_delete INSTEAD OF DELETE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.inventory_items_delete();

COMMENT ON VIEW public.inventory_items IS 'Bridge view → trx.inventory_items (Updated in 041 with process_id)';
