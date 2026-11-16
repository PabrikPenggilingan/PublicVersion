-- Migration 036: Move Inventory tables → trx schema
-- Tables: inventory_items, inventory_sacks, inventory_transactions
-- Strategy: ALTER TABLE SET SCHEMA + writable VIEW bridge in public

-- ============================================================
-- STEP 1: Move tables to trx schema
-- ============================================================
ALTER TABLE public.inventory_items        SET SCHEMA trx;
ALTER TABLE public.inventory_sacks        SET SCHEMA trx;
ALTER TABLE public.inventory_transactions SET SCHEMA trx;

-- ============================================================
-- STEP 2: Create compatibility VIEWS in public schema
-- ============================================================
CREATE VIEW public.inventory_items AS
    SELECT * FROM trx.inventory_items;

CREATE VIEW public.inventory_sacks AS
    SELECT * FROM trx.inventory_sacks;

CREATE VIEW public.inventory_transactions AS
    SELECT * FROM trx.inventory_transactions;

-- ============================================================
-- STEP 3: INSTEAD OF triggers for inventory_items
-- ============================================================
CREATE OR REPLACE FUNCTION public.inv_items_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO trx.inventory_items VALUES (NEW.*);
    RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.inv_items_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE trx.inventory_items
    SET source_type         = NEW.source_type,
        batch_id            = NEW.batch_id,
        drying_id           = NEW.drying_id,
        area                = NEW.area,
        tanda               = NEW.tanda,
        kualitas            = NEW.kualitas,
        avg_price_per_kg    = NEW.avg_price_per_kg,
        total_weight_kg     = NEW.total_weight_kg,
        remaining_weight_kg = NEW.remaining_weight_kg,
        total_sacks         = NEW.total_sacks,
        remaining_sacks     = NEW.remaining_sacks,
        status              = NEW.status,
        entry_date          = NEW.entry_date,
        notes               = NEW.notes,
        created_by          = NEW.created_by,
        updated_at          = NEW.updated_at,
        product_category_code = NEW.product_category_code
    WHERE id = OLD.id;
    RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.inv_items_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM trx.inventory_items WHERE id = OLD.id;
    RETURN OLD;
END; $$;

CREATE TRIGGER inv_items_insert
    INSTEAD OF INSERT ON public.inventory_items
    FOR EACH ROW EXECUTE FUNCTION public.inv_items_insert();

CREATE TRIGGER inv_items_update
    INSTEAD OF UPDATE ON public.inventory_items
    FOR EACH ROW EXECUTE FUNCTION public.inv_items_update();

CREATE TRIGGER inv_items_delete
    INSTEAD OF DELETE ON public.inventory_items
    FOR EACH ROW EXECUTE FUNCTION public.inv_items_delete();

-- ============================================================
-- STEP 4: INSTEAD OF triggers for inventory_sacks
-- ============================================================
CREATE OR REPLACE FUNCTION public.inv_sacks_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO trx.inventory_sacks VALUES (NEW.*);
    RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.inv_sacks_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE trx.inventory_sacks
    SET inventory_item_id = NEW.inventory_item_id,
        sack_number       = NEW.sack_number,
        weight_kg         = NEW.weight_kg,
        is_taken          = NEW.is_taken,
        taken_at          = NEW.taken_at,
        taken_for         = NEW.taken_for,
        taken_ref_id      = NEW.taken_ref_id,
        updated_at        = NEW.updated_at
    WHERE id = OLD.id;
    RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.inv_sacks_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM trx.inventory_sacks WHERE id = OLD.id;
    RETURN OLD;
END; $$;

CREATE TRIGGER inv_sacks_insert
    INSTEAD OF INSERT ON public.inventory_sacks
    FOR EACH ROW EXECUTE FUNCTION public.inv_sacks_insert();

CREATE TRIGGER inv_sacks_update
    INSTEAD OF UPDATE ON public.inventory_sacks
    FOR EACH ROW EXECUTE FUNCTION public.inv_sacks_update();

CREATE TRIGGER inv_sacks_delete
    INSTEAD OF DELETE ON public.inventory_sacks
    FOR EACH ROW EXECUTE FUNCTION public.inv_sacks_delete();

-- ============================================================
-- STEP 5: INSTEAD OF triggers for inventory_transactions
-- ============================================================
CREATE OR REPLACE FUNCTION public.inv_txn_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO trx.inventory_transactions VALUES (NEW.*);
    RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.inv_txn_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM trx.inventory_transactions WHERE id = OLD.id;
    RETURN OLD;
END; $$;

CREATE TRIGGER inv_txn_insert
    INSTEAD OF INSERT ON public.inventory_transactions
    FOR EACH ROW EXECUTE FUNCTION public.inv_txn_insert();

CREATE TRIGGER inv_txn_delete
    INSTEAD OF DELETE ON public.inventory_transactions
    FOR EACH ROW EXECUTE FUNCTION public.inv_txn_delete();

-- ============================================================
-- Comments
-- ============================================================
COMMENT ON VIEW public.inventory_items        IS 'Bridge view → trx.inventory_items';
COMMENT ON VIEW public.inventory_sacks        IS 'Bridge view → trx.inventory_sacks';
COMMENT ON VIEW public.inventory_transactions IS 'Bridge view → trx.inventory_transactions';
