-- Migration 053: Delivery triggers
-- Auto-update sale_items.qty_delivered + deduct inventory stock
-- Auto-update sale.status berdasarkan qty_delivered

-- ───────────────────────────────────────────────
-- 1. Saat delivery_item ditambah/dihapus:
--    Update sale_items.qty_delivered
--    Deduct / restore inventory stock
-- ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_delivery_item_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_item          RECORD;
    v_sale          RECORD;
BEGIN
    -- Get sale_item info
    IF TG_OP = 'DELETE' THEN
        SELECT * INTO v_item FROM sale_items WHERE id = OLD.sale_item_id;
    ELSE
        SELECT * INTO v_item FROM sale_items WHERE id = NEW.sale_item_id;
    END IF;

    -- Get sale info
    SELECT * INTO v_sale FROM sales WHERE id = v_item.sale_id;

    -- Guard: only allow delivery on CONFIRMED or PARTIAL_DELIVERED sales
    IF TG_OP != 'DELETE' AND v_sale.status NOT IN ('CONFIRMED', 'PARTIAL_DELIVERED') THEN
        RAISE EXCEPTION 'Cannot add delivery to a sale with status: %', v_sale.status;
    END IF;

    IF TG_OP = 'INSERT' THEN
        -- 1a. Update qty_delivered on sale_item
        UPDATE sale_items
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
        UPDATE sale_items
        SET qty_delivered = GREATEST(qty_delivered - OLD.qty_delivered, 0)
        WHERE id = OLD.sale_item_id;

        -- 2b. Restore inventory
        IF v_item.inventory_item_id IS NOT NULL THEN
            UPDATE trx.inventory_items
            SET current_weight_kg = current_weight_kg + OLD.qty_delivered
            WHERE id = v_item.inventory_item_id;
        END IF;
    END IF;

    RETURN NULL; -- AFTER trigger
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_delivery_item ON sale_delivery_items;
CREATE TRIGGER trg_handle_delivery_item
    AFTER INSERT OR DELETE ON sale_delivery_items
    FOR EACH ROW EXECUTE FUNCTION handle_delivery_item_change();

-- ───────────────────────────────────────────────
-- 2. Auto-update sale.status setelah delivery:
--    Semua qty terpenuhi → COMPLETED
--    Sebagian → PARTIAL_DELIVERED
-- ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_sale_delivery_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_sale_id   UUID;
    v_total_ordered   DECIMAL;
    v_total_delivered DECIMAL;
    v_current_status  sale_status;
BEGIN
    -- Get sale_id from the delivery record
    IF TG_OP = 'DELETE' THEN
        SELECT sale_id INTO v_sale_id FROM sale_deliveries WHERE id = OLD.delivery_id;
    ELSE
        SELECT sale_id INTO v_sale_id FROM sale_deliveries WHERE id = NEW.delivery_id;
    END IF;

    IF v_sale_id IS NULL THEN RETURN NULL; END IF;

    SELECT status INTO v_current_status FROM sales WHERE id = v_sale_id;

    -- Don't update VOID sales
    IF v_current_status = 'VOID' THEN RETURN NULL; END IF;

    SELECT
        COALESCE(SUM(qty_ordered), 0),
        COALESCE(SUM(qty_delivered), 0)
    INTO v_total_ordered, v_total_delivered
    FROM sale_items
    WHERE sale_id = v_sale_id;

    IF v_total_delivered <= 0 THEN
        UPDATE sales SET status = 'CONFIRMED' WHERE id = v_sale_id;
    ELSIF v_total_delivered >= v_total_ordered THEN
        UPDATE sales SET status = 'COMPLETED' WHERE id = v_sale_id;
    ELSE
        UPDATE sales SET status = 'PARTIAL_DELIVERED' WHERE id = v_sale_id;
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_sale_status ON sale_delivery_items;
CREATE TRIGGER trg_sync_sale_status
    AFTER INSERT OR DELETE ON sale_delivery_items
    FOR EACH ROW EXECUTE FUNCTION sync_sale_delivery_status();
