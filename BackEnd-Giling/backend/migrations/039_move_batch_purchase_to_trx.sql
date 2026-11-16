-- Migration 039: Move core transaction tables → trx schema
-- Tables: batches, purchases, batch_links, batch_completions, purchase_photos
-- Strategy: ALTER TABLE SET SCHEMA + writable VIEW bridge in public

ALTER TABLE public.batches           SET SCHEMA trx;
ALTER TABLE public.purchases         SET SCHEMA trx;
ALTER TABLE public.batch_links       SET SCHEMA trx;
ALTER TABLE public.batch_completions SET SCHEMA trx;
ALTER TABLE public.purchase_photos   SET SCHEMA trx;

-- Compatibility VIEWS
CREATE VIEW public.batches           AS SELECT * FROM trx.batches;
CREATE VIEW public.purchases         AS SELECT * FROM trx.purchases;
CREATE VIEW public.batch_links       AS SELECT * FROM trx.batch_links;
CREATE VIEW public.batch_completions AS SELECT * FROM trx.batch_completions;
CREATE VIEW public.purchase_photos   AS SELECT * FROM trx.purchase_photos;

-- ============================
-- batches triggers
-- ============================
CREATE OR REPLACE FUNCTION public.batches_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO trx.batches (id, created_by, batch_date, status, total_qty_kg, remaining_kg, created_at, updated_at, is_active)
    VALUES (
        COALESCE(NEW.id, uuid_generate_v4()),
        NEW.created_by, NEW.batch_date,
        COALESCE(NEW.status, 'OPEN'),
        COALESCE(NEW.total_qty_kg, 0),
        COALESCE(NEW.remaining_kg, 0),
        COALESCE(NEW.created_at, CURRENT_TIMESTAMP),
        COALESCE(NEW.updated_at, CURRENT_TIMESTAMP),
        COALESCE(NEW.is_active, true)
    );
    RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.batches_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE trx.batches
    SET batch_date   = NEW.batch_date,
        status       = NEW.status,
        is_active    = NEW.is_active,
        created_by   = NEW.created_by,
        updated_at   = NEW.updated_at
    WHERE id = OLD.id;
    RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.batches_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM trx.batches WHERE id = OLD.id; RETURN OLD; END; $$;

CREATE TRIGGER batches_insert INSTEAD OF INSERT ON public.batches FOR EACH ROW EXECUTE FUNCTION public.batches_insert();
CREATE TRIGGER batches_update INSTEAD OF UPDATE ON public.batches FOR EACH ROW EXECUTE FUNCTION public.batches_update();
CREATE TRIGGER batches_delete INSTEAD OF DELETE ON public.batches FOR EACH ROW EXECUTE FUNCTION public.batches_delete();

-- ============================
-- purchases triggers
-- ============================
CREATE OR REPLACE FUNCTION public.purchases_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO trx.purchases (id, batch_id, nama, tanggal_belanja, calo, harga_per_kg, total_harga, lokasi_belanja, koordinat, berat_gabah_kg, kualitas_gabah, created_at, updated_at, filled_by, admin_notes)
    VALUES (
        COALESCE(NEW.id, uuid_generate_v4()),
        NEW.batch_id, NEW.nama, NEW.tanggal_belanja, NEW.calo, NEW.harga_per_kg, NEW.total_harga,
        NEW.lokasi_belanja, NEW.koordinat, NEW.berat_gabah_kg, NEW.kualitas_gabah,
        COALESCE(NEW.created_at, CURRENT_TIMESTAMP),
        COALESCE(NEW.updated_at, CURRENT_TIMESTAMP),
        NEW.filled_by, NEW.admin_notes
    );
    RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.purchases_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE trx.purchases
    SET batch_id          = NEW.batch_id,
        calo              = NEW.calo,
        lokasi_belanja    = NEW.lokasi_belanja,
        koordinat         = NEW.koordinat,
        harga_per_kg      = NEW.harga_per_kg,
        berat_gabah_kg    = NEW.berat_gabah_kg,
        jenis_gabah       = NEW.jenis_gabah,
        kadar_air         = NEW.kadar_air,
        kadar_hampa       = NEW.kadar_hampa,
        kualitas_gabah    = NEW.kualitas_gabah,
        kondisi_gabah     = NEW.kondisi_gabah,
        filled_by         = NEW.filled_by,
        submitted_at      = NEW.submitted_at,
        updated_at        = NEW.updated_at
    WHERE id = OLD.id;
    RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.purchases_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM trx.purchases WHERE id = OLD.id; RETURN OLD; END; $$;

CREATE TRIGGER purchases_insert INSTEAD OF INSERT ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.purchases_insert();
CREATE TRIGGER purchases_update INSTEAD OF UPDATE ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.purchases_update();
CREATE TRIGGER purchases_delete INSTEAD OF DELETE ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.purchases_delete();

-- ============================
-- batch_links triggers
-- ============================
CREATE OR REPLACE FUNCTION public.batch_links_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN INSERT INTO trx.batch_links VALUES (NEW.*); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.batch_links_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE trx.batch_links SET is_active = NEW.is_active, updated_at = NEW.updated_at WHERE id = OLD.id;
    RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.batch_links_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM trx.batch_links WHERE id = OLD.id; RETURN OLD; END; $$;

CREATE TRIGGER batch_links_insert INSTEAD OF INSERT ON public.batch_links FOR EACH ROW EXECUTE FUNCTION public.batch_links_insert();
CREATE TRIGGER batch_links_update INSTEAD OF UPDATE ON public.batch_links FOR EACH ROW EXECUTE FUNCTION public.batch_links_update();
CREATE TRIGGER batch_links_delete INSTEAD OF DELETE ON public.batch_links FOR EACH ROW EXECUTE FUNCTION public.batch_links_delete();

-- ============================
-- batch_completions triggers
-- ============================
CREATE OR REPLACE FUNCTION public.batch_completions_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN INSERT INTO trx.batch_completions VALUES (NEW.*); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.batch_completions_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM trx.batch_completions WHERE id = OLD.id; RETURN OLD; END; $$;

CREATE TRIGGER batch_completions_insert INSTEAD OF INSERT ON public.batch_completions FOR EACH ROW EXECUTE FUNCTION public.batch_completions_insert();
CREATE TRIGGER batch_completions_delete INSTEAD OF DELETE ON public.batch_completions FOR EACH ROW EXECUTE FUNCTION public.batch_completions_delete();

-- ============================
-- purchase_photos triggers
-- ============================
CREATE OR REPLACE FUNCTION public.purchase_photos_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN INSERT INTO trx.purchase_photos VALUES (NEW.*); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.purchase_photos_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM trx.purchase_photos WHERE id = OLD.id; RETURN OLD; END; $$;

CREATE TRIGGER purchase_photos_insert INSTEAD OF INSERT ON public.purchase_photos FOR EACH ROW EXECUTE FUNCTION public.purchase_photos_insert();
CREATE TRIGGER purchase_photos_delete INSTEAD OF DELETE ON public.purchase_photos FOR EACH ROW EXECUTE FUNCTION public.purchase_photos_delete();

COMMENT ON VIEW public.batches           IS 'Bridge view → trx.batches';
COMMENT ON VIEW public.purchases         IS 'Bridge view → trx.purchases';
COMMENT ON VIEW public.batch_links       IS 'Bridge view → trx.batch_links';
COMMENT ON VIEW public.batch_completions IS 'Bridge view → trx.batch_completions';
COMMENT ON VIEW public.purchase_photos   IS 'Bridge view → trx.purchase_photos';
