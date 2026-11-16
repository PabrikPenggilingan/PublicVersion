-- Migration 040: Move process & sales tables → trx schema
-- Tables: processes, process_batches, drying_processes, submission_counts,
--         sales_beras, sales_dedak, sales_sekam, sales_menir, sales_broken,
--         files, pendataan_gabah
-- Strategy: ALTER TABLE SET SCHEMA + writable VIEW bridge in public

ALTER TABLE public.processes          SET SCHEMA trx;
ALTER TABLE public.process_batches    SET SCHEMA trx;
ALTER TABLE public.drying_processes   SET SCHEMA trx;
ALTER TABLE public.submission_counts  SET SCHEMA trx;
ALTER TABLE public.sales_beras        SET SCHEMA trx;
ALTER TABLE public.sales_dedak        SET SCHEMA trx;
ALTER TABLE public.sales_sekam        SET SCHEMA trx;
ALTER TABLE public.sales_menir        SET SCHEMA trx;
ALTER TABLE public.sales_broken       SET SCHEMA trx;
ALTER TABLE public.files              SET SCHEMA trx;
ALTER TABLE public.pendataan_gabah    SET SCHEMA trx;

-- Compatibility VIEWS
CREATE VIEW public.processes         AS SELECT * FROM trx.processes;
CREATE VIEW public.process_batches   AS SELECT * FROM trx.process_batches;
CREATE VIEW public.drying_processes  AS SELECT * FROM trx.drying_processes;
CREATE VIEW public.submission_counts AS SELECT * FROM trx.submission_counts;
CREATE VIEW public.sales_beras       AS SELECT * FROM trx.sales_beras;
CREATE VIEW public.sales_dedak       AS SELECT * FROM trx.sales_dedak;
CREATE VIEW public.sales_sekam       AS SELECT * FROM trx.sales_sekam;
CREATE VIEW public.sales_menir       AS SELECT * FROM trx.sales_menir;
CREATE VIEW public.sales_broken      AS SELECT * FROM trx.sales_broken;
CREATE VIEW public.files             AS SELECT * FROM trx.files;
CREATE VIEW public.pendataan_gabah   AS SELECT * FROM trx.pendataan_gabah;

-- ============================
-- Generic passthrough INSERT trigger helper
-- These tables have complex schemas; we use INSERT INTO ... VALUES (NEW.*) style
-- ============================

-- processes
CREATE OR REPLACE FUNCTION public.processes_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN INSERT INTO trx.processes VALUES (NEW.*); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.processes_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE trx.processes SET
        process_date = NEW.process_date,
        status       = NEW.status,
        notes        = NEW.notes,
        created_by   = NEW.created_by,
        updated_at   = NEW.updated_at
    WHERE id = OLD.id;
    RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.processes_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM trx.processes WHERE id = OLD.id; RETURN OLD; END; $$;
CREATE TRIGGER processes_insert INSTEAD OF INSERT ON public.processes FOR EACH ROW EXECUTE FUNCTION public.processes_insert();
CREATE TRIGGER processes_update INSTEAD OF UPDATE ON public.processes FOR EACH ROW EXECUTE FUNCTION public.processes_update();
CREATE TRIGGER processes_delete INSTEAD OF DELETE ON public.processes FOR EACH ROW EXECUTE FUNCTION public.processes_delete();

-- process_batches
CREATE OR REPLACE FUNCTION public.process_batches_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN INSERT INTO trx.process_batches VALUES (NEW.*); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.process_batches_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM trx.process_batches WHERE id = OLD.id; RETURN OLD; END; $$;
CREATE TRIGGER process_batches_insert INSTEAD OF INSERT ON public.process_batches FOR EACH ROW EXECUTE FUNCTION public.process_batches_insert();
CREATE TRIGGER process_batches_delete INSTEAD OF DELETE ON public.process_batches FOR EACH ROW EXECUTE FUNCTION public.process_batches_delete();

-- drying_processes
CREATE OR REPLACE FUNCTION public.drying_processes_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN INSERT INTO trx.drying_processes VALUES (NEW.*); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.drying_processes_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE trx.drying_processes SET
        name        = NEW.name,
        status      = NEW.status,
        is_active   = NEW.is_active,
        drying_type = NEW.drying_type,
        vendor_name = NEW.vendor_name,
        notes       = NEW.notes,
        created_by  = NEW.created_by,
        updated_at  = NEW.updated_at
    WHERE id = OLD.id;
    RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.drying_processes_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM trx.drying_processes WHERE id = OLD.id; RETURN OLD; END; $$;
CREATE TRIGGER drying_processes_insert INSTEAD OF INSERT ON public.drying_processes FOR EACH ROW EXECUTE FUNCTION public.drying_processes_insert();
CREATE TRIGGER drying_processes_update INSTEAD OF UPDATE ON public.drying_processes FOR EACH ROW EXECUTE FUNCTION public.drying_processes_update();
CREATE TRIGGER drying_processes_delete INSTEAD OF DELETE ON public.drying_processes FOR EACH ROW EXECUTE FUNCTION public.drying_processes_delete();

-- submission_counts
CREATE OR REPLACE FUNCTION public.submission_counts_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN INSERT INTO trx.submission_counts VALUES (NEW.*); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.submission_counts_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE trx.submission_counts SET count = NEW.count, updated_at = NEW.updated_at
    WHERE entity_type = OLD.entity_type AND entity_id = OLD.entity_id;
    RETURN NEW;
END; $$;
CREATE TRIGGER submission_counts_insert INSTEAD OF INSERT ON public.submission_counts FOR EACH ROW EXECUTE FUNCTION public.submission_counts_insert();
CREATE TRIGGER submission_counts_update INSTEAD OF UPDATE ON public.submission_counts FOR EACH ROW EXECUTE FUNCTION public.submission_counts_update();

-- sales_beras
CREATE OR REPLACE FUNCTION public.sales_beras_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN INSERT INTO trx.sales_beras VALUES (NEW.*); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.sales_beras_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE trx.sales_beras SET
        process_id  = NEW.process_id,
        buyer_name  = NEW.buyer_name,
        quantity_kg = NEW.quantity_kg,
        price_per_kg = NEW.price_per_kg,
        total_price = NEW.total_price,
        notes       = NEW.notes,
        created_by  = NEW.created_by,
        updated_at  = NEW.updated_at
    WHERE id = OLD.id;
    RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.sales_beras_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM trx.sales_beras WHERE id = OLD.id; RETURN OLD; END; $$;
CREATE TRIGGER sales_beras_insert INSTEAD OF INSERT ON public.sales_beras FOR EACH ROW EXECUTE FUNCTION public.sales_beras_insert();
CREATE TRIGGER sales_beras_update INSTEAD OF UPDATE ON public.sales_beras FOR EACH ROW EXECUTE FUNCTION public.sales_beras_update();
CREATE TRIGGER sales_beras_delete INSTEAD OF DELETE ON public.sales_beras FOR EACH ROW EXECUTE FUNCTION public.sales_beras_delete();

-- sales_dedak (simple INSERT/DELETE pattern like sales_beras)
CREATE OR REPLACE FUNCTION public.sales_dedak_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN INSERT INTO trx.sales_dedak VALUES (NEW.*); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.sales_dedak_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE trx.sales_dedak SET process_id=NEW.process_id, buyer_name=NEW.buyer_name,
        quantity_kg=NEW.quantity_kg, price_per_kg=NEW.price_per_kg, total_price=NEW.total_price,
        notes=NEW.notes, created_by=NEW.created_by, updated_at=NEW.updated_at WHERE id=OLD.id;
    RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.sales_dedak_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM trx.sales_dedak WHERE id = OLD.id; RETURN OLD; END; $$;
CREATE TRIGGER sales_dedak_insert INSTEAD OF INSERT ON public.sales_dedak FOR EACH ROW EXECUTE FUNCTION public.sales_dedak_insert();
CREATE TRIGGER sales_dedak_update INSTEAD OF UPDATE ON public.sales_dedak FOR EACH ROW EXECUTE FUNCTION public.sales_dedak_update();
CREATE TRIGGER sales_dedak_delete INSTEAD OF DELETE ON public.sales_dedak FOR EACH ROW EXECUTE FUNCTION public.sales_dedak_delete();

-- sales_sekam
CREATE OR REPLACE FUNCTION public.sales_sekam_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN INSERT INTO trx.sales_sekam VALUES (NEW.*); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.sales_sekam_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE trx.sales_sekam SET process_id=NEW.process_id, buyer_name=NEW.buyer_name,
        quantity_kg=NEW.quantity_kg, price_per_kg=NEW.price_per_kg, total_price=NEW.total_price,
        notes=NEW.notes, created_by=NEW.created_by, updated_at=NEW.updated_at WHERE id=OLD.id;
    RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.sales_sekam_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM trx.sales_sekam WHERE id = OLD.id; RETURN OLD; END; $$;
CREATE TRIGGER sales_sekam_insert INSTEAD OF INSERT ON public.sales_sekam FOR EACH ROW EXECUTE FUNCTION public.sales_sekam_insert();
CREATE TRIGGER sales_sekam_update INSTEAD OF UPDATE ON public.sales_sekam FOR EACH ROW EXECUTE FUNCTION public.sales_sekam_update();
CREATE TRIGGER sales_sekam_delete INSTEAD OF DELETE ON public.sales_sekam FOR EACH ROW EXECUTE FUNCTION public.sales_sekam_delete();

-- sales_menir
CREATE OR REPLACE FUNCTION public.sales_menir_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN INSERT INTO trx.sales_menir VALUES (NEW.*); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.sales_menir_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE trx.sales_menir SET process_id=NEW.process_id, buyer_name=NEW.buyer_name,
        quantity_kg=NEW.quantity_kg, price_per_kg=NEW.price_per_kg, total_price=NEW.total_price,
        notes=NEW.notes, created_by=NEW.created_by, updated_at=NEW.updated_at WHERE id=OLD.id;
    RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.sales_menir_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM trx.sales_menir WHERE id = OLD.id; RETURN OLD; END; $$;
CREATE TRIGGER sales_menir_insert INSTEAD OF INSERT ON public.sales_menir FOR EACH ROW EXECUTE FUNCTION public.sales_menir_insert();
CREATE TRIGGER sales_menir_update INSTEAD OF UPDATE ON public.sales_menir FOR EACH ROW EXECUTE FUNCTION public.sales_menir_update();
CREATE TRIGGER sales_menir_delete INSTEAD OF DELETE ON public.sales_menir FOR EACH ROW EXECUTE FUNCTION public.sales_menir_delete();

-- sales_broken
CREATE OR REPLACE FUNCTION public.sales_broken_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN INSERT INTO trx.sales_broken VALUES (NEW.*); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.sales_broken_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE trx.sales_broken SET process_id=NEW.process_id, buyer_name=NEW.buyer_name,
        quantity_kg=NEW.quantity_kg, price_per_kg=NEW.price_per_kg, total_price=NEW.total_price,
        notes=NEW.notes, created_by=NEW.created_by, updated_at=NEW.updated_at WHERE id=OLD.id;
    RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.sales_broken_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM trx.sales_broken WHERE id = OLD.id; RETURN OLD; END; $$;
CREATE TRIGGER sales_broken_insert INSTEAD OF INSERT ON public.sales_broken FOR EACH ROW EXECUTE FUNCTION public.sales_broken_insert();
CREATE TRIGGER sales_broken_update INSTEAD OF UPDATE ON public.sales_broken FOR EACH ROW EXECUTE FUNCTION public.sales_broken_update();
CREATE TRIGGER sales_broken_delete INSTEAD OF DELETE ON public.sales_broken FOR EACH ROW EXECUTE FUNCTION public.sales_broken_delete();

-- files
CREATE OR REPLACE FUNCTION public.files_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN INSERT INTO trx.files VALUES (NEW.*); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.files_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM trx.files WHERE id = OLD.id; RETURN OLD; END; $$;
CREATE TRIGGER files_insert INSTEAD OF INSERT ON public.files FOR EACH ROW EXECUTE FUNCTION public.files_insert();
CREATE TRIGGER files_delete INSTEAD OF DELETE ON public.files FOR EACH ROW EXECUTE FUNCTION public.files_delete();

-- pendataan_gabah
CREATE OR REPLACE FUNCTION public.pendataan_gabah_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN INSERT INTO trx.pendataan_gabah VALUES (NEW.*); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.pendataan_gabah_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE trx.pendataan_gabah SET
        purchase_id    = NEW.purchase_id,
        jenis_gabah    = NEW.jenis_gabah,
        varietas       = NEW.varietas,
        kondisi_gabah  = NEW.kondisi_gabah,
        kadar_air      = NEW.kadar_air,
        kadar_hampa    = NEW.kadar_hampa,
        butir_rusak    = NEW.butir_rusak,
        benda_asing    = NEW.benda_asing,
        notes          = NEW.notes,
        created_by     = NEW.created_by,
        updated_at     = NEW.updated_at
    WHERE id = OLD.id;
    RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.pendataan_gabah_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM trx.pendataan_gabah WHERE id = OLD.id; RETURN OLD; END; $$;
CREATE TRIGGER pendataan_gabah_insert INSTEAD OF INSERT ON public.pendataan_gabah FOR EACH ROW EXECUTE FUNCTION public.pendataan_gabah_insert();
CREATE TRIGGER pendataan_gabah_update INSTEAD OF UPDATE ON public.pendataan_gabah FOR EACH ROW EXECUTE FUNCTION public.pendataan_gabah_update();
CREATE TRIGGER pendataan_gabah_delete INSTEAD OF DELETE ON public.pendataan_gabah FOR EACH ROW EXECUTE FUNCTION public.pendataan_gabah_delete();

COMMENT ON VIEW public.processes        IS 'Bridge view → trx.processes';
COMMENT ON VIEW public.process_batches  IS 'Bridge view → trx.process_batches';
COMMENT ON VIEW public.drying_processes IS 'Bridge view → trx.drying_processes';
COMMENT ON VIEW public.sales_beras      IS 'Bridge view → trx.sales_beras';
COMMENT ON VIEW public.sales_dedak      IS 'Bridge view → trx.sales_dedak';
COMMENT ON VIEW public.sales_sekam      IS 'Bridge view → trx.sales_sekam';
COMMENT ON VIEW public.sales_menir      IS 'Bridge view → trx.sales_menir';
COMMENT ON VIEW public.sales_broken     IS 'Bridge view → trx.sales_broken';
COMMENT ON VIEW public.files            IS 'Bridge view → trx.files';
COMMENT ON VIEW public.pendataan_gabah  IS 'Bridge view → trx.pendataan_gabah';
