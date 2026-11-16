-- Migration 057: Fix column name in Inventory Transactions
-- The inventory_transactions table uses weight_kg, not quantity_kg

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

        -- 1b. Deduct inventory (remaining_weight_kg)
        IF v_item.inventory_item_id IS NOT NULL THEN
            UPDATE trx.inventory_items
            SET remaining_weight_kg = remaining_weight_kg - NEW.qty_delivered
            WHERE id = v_item.inventory_item_id;

            -- Log inventory transaction (Fix: weight_kg)
            INSERT INTO trx.inventory_transactions (
                inventory_item_id, transaction_type, weight_kg,
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

        -- 2b. Restore inventory (remaining_weight_kg)
        IF v_item.inventory_item_id IS NOT NULL THEN
            UPDATE trx.inventory_items
            SET remaining_weight_kg = remaining_weight_kg + OLD.qty_delivered
            WHERE id = v_item.inventory_item_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$;
