-- Migration 037: Move core drying & batch transaction tables → trx schema
-- Tables: drying_sessions, drying_batches, drying_links, drying_photos
-- Strategy: ALTER TABLE SET SCHEMA + writable VIEW bridge in public

-- ============================================================
-- STEP 1: Move tables to trx schema
-- ============================================================
ALTER TABLE public.drying_sessions SET SCHEMA trx;
ALTER TABLE public.drying_batches  SET SCHEMA trx;
ALTER TABLE public.drying_links    SET SCHEMA trx;
ALTER TABLE public.drying_photos   SET SCHEMA trx;

-- ============================================================
-- STEP 2: Create compatibility VIEWS in public schema
-- ============================================================
CREATE VIEW public.drying_sessions AS SELECT * FROM trx.drying_sessions;
CREATE VIEW public.drying_batches  AS SELECT * FROM trx.drying_batches;
CREATE VIEW public.drying_links    AS SELECT * FROM trx.drying_links;
CREATE VIEW public.drying_photos   AS SELECT * FROM trx.drying_photos;

-- ============================================================
-- STEP 3: drying_sessions INSTEAD OF triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.dry_sessions_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN INSERT INTO trx.drying_sessions VALUES (NEW.*); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.dry_sessions_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE trx.drying_sessions
    SET drying_id           = NEW.drying_id,
        session_type        = NEW.session_type,
        tonnage_kg          = NEW.tonnage_kg,
        moisture_content    = NEW.moisture_content,
        people_involved     = NEW.people_involved,
        started_by          = NEW.started_by,
        ended_by            = NEW.ended_by,
        session_start       = NEW.session_start,
        session_end         = NEW.session_end,
        notes               = NEW.notes,
        created_at          = NEW.created_at
    WHERE id = OLD.id;
    RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.dry_sessions_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM trx.drying_sessions WHERE id = OLD.id; RETURN OLD; END; $$;

CREATE TRIGGER dry_sessions_insert INSTEAD OF INSERT ON public.drying_sessions FOR EACH ROW EXECUTE FUNCTION public.dry_sessions_insert();
CREATE TRIGGER dry_sessions_update INSTEAD OF UPDATE ON public.drying_sessions FOR EACH ROW EXECUTE FUNCTION public.dry_sessions_update();
CREATE TRIGGER dry_sessions_delete INSTEAD OF DELETE ON public.drying_sessions FOR EACH ROW EXECUTE FUNCTION public.dry_sessions_delete();

-- ============================================================
-- STEP 4: drying_batches INSTEAD OF triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.dry_batches_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN INSERT INTO trx.drying_batches VALUES (NEW.*); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.dry_batches_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM trx.drying_batches WHERE id = OLD.id; RETURN OLD; END; $$;

CREATE TRIGGER dry_batches_insert INSTEAD OF INSERT ON public.drying_batches FOR EACH ROW EXECUTE FUNCTION public.dry_batches_insert();
CREATE TRIGGER dry_batches_delete INSTEAD OF DELETE ON public.drying_batches FOR EACH ROW EXECUTE FUNCTION public.dry_batches_delete();

-- ============================================================
-- STEP 5: drying_links INSTEAD OF triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.dry_links_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN INSERT INTO trx.drying_links VALUES (NEW.*); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.dry_links_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE trx.drying_links
    SET drying_id  = NEW.drying_id,
        link_code  = NEW.link_code,
        is_active  = NEW.is_active,
        created_by = NEW.created_by,
        expires_at = NEW.expires_at,
        created_at = NEW.created_at
    WHERE id = OLD.id;
    RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.dry_links_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM trx.drying_links WHERE id = OLD.id; RETURN OLD; END; $$;

CREATE TRIGGER dry_links_insert INSTEAD OF INSERT ON public.drying_links FOR EACH ROW EXECUTE FUNCTION public.dry_links_insert();
CREATE TRIGGER dry_links_update INSTEAD OF UPDATE ON public.drying_links FOR EACH ROW EXECUTE FUNCTION public.dry_links_update();
CREATE TRIGGER dry_links_delete INSTEAD OF DELETE ON public.drying_links FOR EACH ROW EXECUTE FUNCTION public.dry_links_delete();

-- ============================================================
-- STEP 6: drying_photos INSTEAD OF triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.dry_photos_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN INSERT INTO trx.drying_photos VALUES (NEW.*); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.dry_photos_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM trx.drying_photos WHERE id = OLD.id; RETURN OLD; END; $$;

CREATE TRIGGER dry_photos_insert INSTEAD OF INSERT ON public.drying_photos FOR EACH ROW EXECUTE FUNCTION public.dry_photos_insert();
CREATE TRIGGER dry_photos_delete INSTEAD OF DELETE ON public.drying_photos FOR EACH ROW EXECUTE FUNCTION public.dry_photos_delete();

-- ============================================================
-- Comments
-- ============================================================
COMMENT ON VIEW public.drying_sessions IS 'Bridge view → trx.drying_sessions';
COMMENT ON VIEW public.drying_batches  IS 'Bridge view → trx.drying_batches';
COMMENT ON VIEW public.drying_links    IS 'Bridge view → trx.drying_links';
COMMENT ON VIEW public.drying_photos   IS 'Bridge view → trx.drying_photos';
