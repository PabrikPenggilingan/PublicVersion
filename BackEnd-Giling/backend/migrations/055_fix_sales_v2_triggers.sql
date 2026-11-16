-- Migration 055: Fix Sales V2 triggers (qualified names + missing update triggers)
-- Use qualified names to bypass view vs table ambiguity
-- Add missing INSTEAD OF UPDATE triggers for public views

-- 1. Update handle_delivery_item_change to use trx schema
CREATE OR REPLACE FUNCTION handle_delivery_item_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_item          RECORD;
    v_sale          RECORD;
BEGIN
    -- Get sale_item info (always use trx schema)
    IF TG_OP = 'DELETE' THEN
        SELECT * INTO v_item FROM trx.sale_items WHERE id = OLD.sale_item_id;
    ELSE
        SELECT * INTO v_item FROM trx.sale_items WHERE id = NEW.sale_item_id;
    END IF;

    -- Get sale info (always use trx schema)
    SELECT * INTO v_sale FROM trx.sales WHERE id = v_item.sale_id;

    -- Guard: only allow delivery on CONFIRMED or PARTIAL_DELIVERED sales
    IF TG_OP != 'DELETE' AND v_sale.status NOT IN ('CONFIRMED', 'PARTIAL_DELIVERED') THEN
        RAISE EXCEPTION 'Cannot add delivery to a sale with status: %', v_sale.status;
    END IF;

    IF TG_OP = 'INSERT' THEN
        -- 1a. Update qty_delivered on sale_item
        UPDATE trx.sale_items
        SET qty_delivered = qty_delivered + NEW.qty_delivered
        WHERE id = NEW.sale_item_id;

        -- 1b. Deduct inventory
        IF v_item.inventory_item_id IS NOT NULL THEN
            UPDATE trx.inventory_items
            SET current_weight_kg = current_weight_kg - NEW.qty_delivered
            WHERE id = v_item.inventory_item_id;

            -- Log inventory transaction
            INSERT INTO trx.inventory_transactions (
                inventory_item_id, transaction_type, quantity_kg,
                reference_id, reference_type, notes
            ) VALUES (
                v_item.inventory_item_id, 'OUT', NEW.qty_delivered,
                v_item.sale_id, 'SALE',
                'Delivery ke customer — Nota: ' || v_sale.sale_no
            );
        END IF;

    ELSIF TG_OP = 'DELETE' THEN
        -- 2a. Restore qty_delivered on sale_item
        UPDATE trx.sale_items
        SET qty_delivered = GREATEST(qty_delivered - OLD.qty_delivered, 0)
        WHERE id = OLD.sale_item_id;

        -- 2b. Restore inventory
        IF v_item.inventory_item_id IS NOT NULL THEN
            UPDATE trx.inventory_items
            SET current_weight_kg = current_weight_kg + OLD.qty_delivered
            WHERE id = v_item.inventory_item_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$;

-- 2. Update sync_sale_delivery_status to use trx schema
CREATE OR REPLACE FUNCTION sync_sale_delivery_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_sale_id   UUID;
    v_total_ordered   DECIMAL;
    v_total_delivered DECIMAL;
    v_current_status  public.sale_status; -- sale_status was likely created in public
BEGIN
    -- Get sale_id from the delivery record
    IF TG_OP = 'DELETE' THEN
        SELECT sale_id INTO v_sale_id FROM trx.sale_deliveries WHERE id = OLD.delivery_id;
    ELSE
        SELECT sale_id INTO v_sale_id FROM trx.sale_deliveries WHERE id = NEW.delivery_id;
    END IF;

    IF v_sale_id IS NULL THEN RETURN NULL; END IF;

    SELECT status INTO v_current_status FROM trx.sales WHERE id = v_sale_id;

    -- Don't update VOID sales
    IF v_current_status = 'VOID' THEN RETURN NULL; END IF;

    SELECT
        COALESCE(SUM(qty_ordered), 0),
        COALESCE(SUM(qty_delivered), 0)
    INTO v_total_ordered, v_total_delivered
    FROM trx.sale_items
    WHERE sale_id = v_sale_id;

    IF v_total_delivered <= 0 THEN
        UPDATE trx.sales SET status = 'CONFIRMED' WHERE id = v_sale_id;
    ELSIF v_total_delivered >= v_total_ordered THEN
        UPDATE trx.sales SET status = 'COMPLETED' WHERE id = v_sale_id;
    ELSE
        UPDATE trx.sales SET status = 'PARTIAL_DELIVERED' WHERE id = v_sale_id;
    END IF;

    RETURN NULL;
END;
$$;

-- 3. Add missing UPDATE triggers for public views (for safety)
CREATE OR REPLACE FUNCTION public.sale_items_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE trx.sale_items SET
        qty_ordered   = NEW.qty_ordered,
        qty_delivered = NEW.qty_delivered,
        unit_price    = NEW.unit_price,
        subtotal      = NEW.subtotal
    WHERE id = OLD.id; RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS sale_items_update ON public.sale_items;
CREATE TRIGGER sale_items_update INSTEAD OF UPDATE ON public.sale_items FOR EACH ROW EXECUTE FUNCTION public.sale_items_update();

CREATE OR REPLACE FUNCTION public.sale_deliveries_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE trx.sale_deliveries SET
        delivery_date = NEW.delivery_date,
        notes         = NEW.notes
    WHERE id = OLD.id; RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS sale_deliveries_update ON public.sale_deliveries;
CREATE TRIGGER sale_deliveries_update INSTEAD OF UPDATE ON public.sale_deliveries FOR EACH ROW EXECUTE FUNCTION public.sale_deliveries_update();

CREATE OR REPLACE FUNCTION public.sale_payments_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE trx.sale_payments SET
        payment_date = NEW.payment_date,
        amount       = NEW.amount,
        method       = NEW.method,
        reference_no = NEW.reference_no,
        notes        = NEW.notes
    WHERE id = OLD.id; RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS sale_payments_update ON public.sale_payments;
CREATE TRIGGER sale_payments_update INSTEAD OF UPDATE ON public.sale_payments FOR EACH ROW EXECUTE FUNCTION public.sale_payments_update();
