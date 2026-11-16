-- Migration 052: Auto-generate sale_no + auto-update sale totals

-- ───────────────────────────────────────────────
-- 1. Auto-generate sale_no: JUAL/YYYY/MM/XXX
-- ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_sale_no()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_year      TEXT;
    v_month     TEXT;
    v_seq       INT;
    v_sale_no   TEXT;
BEGIN
    -- Only generate if not already set
    IF NEW.sale_no IS NOT NULL THEN
        RETURN NEW;
    END IF;

    v_year  := TO_CHAR(NEW.sale_date, 'YYYY');
    v_month := TO_CHAR(NEW.sale_date, 'MM');

    -- Count existing notes this month to get sequence
    SELECT COUNT(*) + 1 INTO v_seq
    FROM sales
    WHERE TO_CHAR(sale_date, 'YYYY-MM') = v_year || '-' || v_month
      AND sale_no IS NOT NULL;

    v_sale_no := 'JUAL/' || v_year || '/' || v_month || '/' || LPAD(v_seq::TEXT, 3, '0');
    NEW.sale_no := v_sale_no;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_sale_no ON sales;
CREATE TRIGGER trg_generate_sale_no
    BEFORE INSERT ON sales
    FOR EACH ROW EXECUTE FUNCTION generate_sale_no();

-- ───────────────────────────────────────────────
-- 2. Auto-update sales.subtotal & total_amount
--    setiap kali sale_items berubah
-- ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_sale_subtotal()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_sale_id UUID;
    v_subtotal DECIMAL(14,2);
BEGIN
    -- Determine which sale_id to update
    IF TG_OP = 'DELETE' THEN
        v_sale_id := OLD.sale_id;
    ELSE
        v_sale_id := NEW.sale_id;
    END IF;

    SELECT COALESCE(SUM(unit_price * qty_ordered), 0)
    INTO v_subtotal
    FROM sale_items
    WHERE sale_id = v_sale_id;

    UPDATE sales
    SET subtotal     = v_subtotal,
        total_amount = v_subtotal + adjustment
    WHERE id = v_sale_id;

    RETURN NULL; -- AFTER trigger
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_sale_subtotal ON sale_items;
CREATE TRIGGER trg_sync_sale_subtotal
    AFTER INSERT OR UPDATE OR DELETE ON sale_items
    FOR EACH ROW EXECUTE FUNCTION sync_sale_subtotal();

-- ───────────────────────────────────────────────
-- 3. Auto-update sales.paid_amount & payment_status
--    setiap kali sale_payments berubah
-- ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_sale_paid_amount()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_sale_id       UUID;
    v_paid          DECIMAL(14,2);
    v_total         DECIMAL(14,2);
    v_pay_status    payment_status;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_sale_id := OLD.sale_id;
    ELSE
        v_sale_id := NEW.sale_id;
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_paid
    FROM sale_payments
    WHERE sale_id = v_sale_id;

    SELECT total_amount INTO v_total FROM sales WHERE id = v_sale_id;

    IF v_paid <= 0 THEN
        v_pay_status := 'UNPAID';
    ELSIF v_paid >= v_total THEN
        v_pay_status := 'PAID';
    ELSE
        v_pay_status := 'PARTIAL';
    END IF;

    UPDATE sales
    SET paid_amount     = v_paid,
        payment_status  = v_pay_status
    WHERE id = v_sale_id;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_sale_paid_amount ON sale_payments;
CREATE TRIGGER trg_sync_sale_paid_amount
    AFTER INSERT OR UPDATE OR DELETE ON sale_payments
    FOR EACH ROW EXECUTE FUNCTION sync_sale_paid_amount();

-- ───────────────────────────────────────────────
-- 4. Auto-update sales.adjustment & total_amount
--    setiap kali sale_returns berubah
-- ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_sale_adjustment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_sale_id       UUID;
    v_adjustment    DECIMAL(14,2);
    v_subtotal      DECIMAL(14,2);
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_sale_id := OLD.sale_id;
    ELSE
        v_sale_id := NEW.sale_id;
    END IF;

    -- Adjustment = negative sum of all returns
    SELECT COALESCE(-SUM(amount_adjusted), 0) INTO v_adjustment
    FROM sale_returns
    WHERE sale_id = v_sale_id;

    SELECT subtotal INTO v_subtotal FROM sales WHERE id = v_sale_id;

    UPDATE sales
    SET adjustment   = v_adjustment,
        total_amount = v_subtotal + v_adjustment
    WHERE id = v_sale_id;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_sale_adjustment ON sale_returns;
CREATE TRIGGER trg_sync_sale_adjustment
    AFTER INSERT OR UPDATE OR DELETE ON sale_returns
    FOR EACH ROW EXECUTE FUNCTION sync_sale_adjustment();
