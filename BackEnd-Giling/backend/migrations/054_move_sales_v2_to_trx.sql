-- Migration 054: Move Sales V2 tables → trx / mst schemas
-- Tables: customers, customer_tiers → trx.customers, mst.customer_tiers
--         price_list → mst.price_list
--         sales, sale_items, sale_deliveries, sale_delivery_items,
--         sale_payments, sale_returns → trx.*

-- ─────────────────────────────────
-- Master tables → mst schema
-- ─────────────────────────────────
ALTER TABLE public.customer_tiers SET SCHEMA mst;
ALTER TABLE public.price_list      SET SCHEMA mst;

-- ─────────────────────────────────
-- Transaction tables → trx schema
-- ─────────────────────────────────
ALTER TABLE public.customers            SET SCHEMA trx;
ALTER TABLE public.sales                SET SCHEMA trx;
ALTER TABLE public.sale_items           SET SCHEMA trx;
ALTER TABLE public.sale_deliveries      SET SCHEMA trx;
ALTER TABLE public.sale_delivery_items  SET SCHEMA trx;
ALTER TABLE public.sale_payments        SET SCHEMA trx;
ALTER TABLE public.sale_returns         SET SCHEMA trx;

-- ─────────────────────────────────
-- Compatibility VIEWs in public
-- ─────────────────────────────────
CREATE VIEW public.customer_tiers       AS SELECT * FROM mst.customer_tiers;
CREATE VIEW public.price_list           AS SELECT * FROM mst.price_list;
CREATE VIEW public.customers            AS SELECT * FROM trx.customers;
CREATE VIEW public.sales                AS SELECT * FROM trx.sales;
CREATE VIEW public.sale_items           AS SELECT * FROM trx.sale_items;
CREATE VIEW public.sale_deliveries      AS SELECT * FROM trx.sale_deliveries;
CREATE VIEW public.sale_delivery_items  AS SELECT * FROM trx.sale_delivery_items;
CREATE VIEW public.sale_payments        AS SELECT * FROM trx.sale_payments;
CREATE VIEW public.sale_returns         AS SELECT * FROM trx.sale_returns;

-- ─────────────────────────────────
-- INSTEAD OF triggers for writable views
-- ─────────────────────────────────

-- customers
CREATE OR REPLACE FUNCTION public.customers_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN INSERT INTO trx.customers VALUES (NEW.*); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.customers_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE trx.customers SET
        name       = NEW.name,
        phone      = NEW.phone,
        address    = NEW.address,
        tier_id    = NEW.tier_id,
        notes      = NEW.notes,
        is_active  = NEW.is_active,
        updated_at = NEW.updated_at
    WHERE id = OLD.id; RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.customers_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM trx.customers WHERE id = OLD.id; RETURN OLD; END; $$;
CREATE TRIGGER customers_insert INSTEAD OF INSERT ON public.customers FOR EACH ROW EXECUTE FUNCTION public.customers_insert();
CREATE TRIGGER customers_update INSTEAD OF UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.customers_update();
CREATE TRIGGER customers_delete INSTEAD OF DELETE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.customers_delete();

-- sales header
CREATE OR REPLACE FUNCTION public.sales_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN INSERT INTO trx.sales VALUES (NEW.*); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.sales_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE trx.sales SET
        status         = NEW.status,
        payment_status = NEW.payment_status,
        subtotal       = NEW.subtotal,
        adjustment     = NEW.adjustment,
        total_amount   = NEW.total_amount,
        paid_amount    = NEW.paid_amount,
        notes          = NEW.notes,
        void_reason    = NEW.void_reason,
        void_at        = NEW.void_at,
        void_by        = NEW.void_by,
        updated_at     = NEW.updated_at
    WHERE id = OLD.id; RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.sales_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM trx.sales WHERE id = OLD.id; RETURN OLD; END; $$;
CREATE TRIGGER sales_v2_insert INSTEAD OF INSERT ON public.sales FOR EACH ROW EXECUTE FUNCTION public.sales_insert();
CREATE TRIGGER sales_v2_update INSTEAD OF UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.sales_update();
CREATE TRIGGER sales_v2_delete INSTEAD OF DELETE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.sales_delete();

-- sale_items
CREATE OR REPLACE FUNCTION public.sale_items_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN INSERT INTO trx.sale_items VALUES (NEW.*); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.sale_items_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM trx.sale_items WHERE id = OLD.id; RETURN OLD; END; $$;
CREATE TRIGGER sale_items_insert INSTEAD OF INSERT ON public.sale_items FOR EACH ROW EXECUTE FUNCTION public.sale_items_insert();
CREATE TRIGGER sale_items_delete INSTEAD OF DELETE ON public.sale_items FOR EACH ROW EXECUTE FUNCTION public.sale_items_delete();

-- sale_deliveries & items
CREATE OR REPLACE FUNCTION public.sale_deliveries_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN INSERT INTO trx.sale_deliveries VALUES (NEW.*); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.sale_deliveries_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM trx.sale_deliveries WHERE id = OLD.id; RETURN OLD; END; $$;
CREATE TRIGGER sale_deliveries_insert INSTEAD OF INSERT ON public.sale_deliveries FOR EACH ROW EXECUTE FUNCTION public.sale_deliveries_insert();
CREATE TRIGGER sale_deliveries_delete INSTEAD OF DELETE ON public.sale_deliveries FOR EACH ROW EXECUTE FUNCTION public.sale_deliveries_delete();

CREATE OR REPLACE FUNCTION public.sale_delivery_items_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN INSERT INTO trx.sale_delivery_items VALUES (NEW.*); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.sale_delivery_items_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM trx.sale_delivery_items WHERE id = OLD.id; RETURN OLD; END; $$;
CREATE TRIGGER sale_delivery_items_insert INSTEAD OF INSERT ON public.sale_delivery_items FOR EACH ROW EXECUTE FUNCTION public.sale_delivery_items_insert();
CREATE TRIGGER sale_delivery_items_delete INSTEAD OF DELETE ON public.sale_delivery_items FOR EACH ROW EXECUTE FUNCTION public.sale_delivery_items_delete();

-- sale_payments
CREATE OR REPLACE FUNCTION public.sale_payments_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN INSERT INTO trx.sale_payments VALUES (NEW.*); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.sale_payments_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM trx.sale_payments WHERE id = OLD.id; RETURN OLD; END; $$;
CREATE TRIGGER sale_payments_insert INSTEAD OF INSERT ON public.sale_payments FOR EACH ROW EXECUTE FUNCTION public.sale_payments_insert();
CREATE TRIGGER sale_payments_delete INSTEAD OF DELETE ON public.sale_payments FOR EACH ROW EXECUTE FUNCTION public.sale_payments_delete();

-- sale_returns
CREATE OR REPLACE FUNCTION public.sale_returns_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN INSERT INTO trx.sale_returns VALUES (NEW.*); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.sale_returns_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM trx.sale_returns WHERE id = OLD.id; RETURN OLD; END; $$;
CREATE TRIGGER sale_returns_insert INSTEAD OF INSERT ON public.sale_returns FOR EACH ROW EXECUTE FUNCTION public.sale_returns_insert();
CREATE TRIGGER sale_returns_delete INSTEAD OF DELETE ON public.sale_returns FOR EACH ROW EXECUTE FUNCTION public.sale_returns_delete();

COMMENT ON VIEW public.customers            IS 'Bridge view → trx.customers';
COMMENT ON VIEW public.sales                IS 'Bridge view → trx.sales';
COMMENT ON VIEW public.customer_tiers       IS 'Bridge view → mst.customer_tiers';
COMMENT ON VIEW public.price_list           IS 'Bridge view → mst.price_list';
