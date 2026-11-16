-- Migration 038: Move System tables → sys schema
-- Tables: users, wizard_states, upload_intents
-- Strategy: ALTER TABLE SET SCHEMA + writable VIEW bridge in public

-- ============================================================
-- STEP 1: Move tables to sys schema
-- ============================================================
ALTER TABLE public.users           SET SCHEMA sys;
ALTER TABLE public.wizard_states   SET SCHEMA sys;
ALTER TABLE public.upload_intents  SET SCHEMA sys;

-- ============================================================
-- STEP 2: Compatibility VIEWS in public
-- ============================================================
CREATE VIEW public.users          AS SELECT * FROM sys.users;
CREATE VIEW public.wizard_states  AS SELECT * FROM sys.wizard_states;
CREATE VIEW public.upload_intents AS SELECT * FROM sys.upload_intents;

-- ============================================================
-- STEP 3: INSTEAD OF triggers — users
-- ============================================================
CREATE OR REPLACE FUNCTION public.users_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO sys.users (id, username, password_hash, role, created_at, updated_at)
    VALUES (
        COALESCE(NEW.id, uuid_generate_v4()),
        NEW.username,
        NEW.password_hash,
        NEW.role,
        COALESCE(NEW.created_at, CURRENT_TIMESTAMP),
        COALESCE(NEW.updated_at, CURRENT_TIMESTAMP)
    );
    RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.users_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE sys.users
    SET username   = NEW.username,
        password_hash   = NEW.password_hash,
        role       = NEW.role,
        is_active  = NEW.is_active,
        created_at = NEW.created_at,
        updated_at = NEW.updated_at
    WHERE id = OLD.id;
    RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.users_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM sys.users WHERE id = OLD.id; RETURN OLD; END; $$;

CREATE TRIGGER users_insert INSTEAD OF INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.users_insert();
CREATE TRIGGER users_update INSTEAD OF UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.users_update();
CREATE TRIGGER users_delete INSTEAD OF DELETE ON public.users FOR EACH ROW EXECUTE FUNCTION public.users_delete();

-- ============================================================
-- STEP 4: INSTEAD OF triggers — wizard_states
-- ============================================================
CREATE OR REPLACE FUNCTION public.wizard_states_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN INSERT INTO sys.wizard_states VALUES (NEW.*); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.wizard_states_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE sys.wizard_states
    SET user_id      = NEW.user_id,
        entity_type  = NEW.entity_type,
        entity_id    = NEW.entity_id,
        current_step = NEW.current_step,
        step_data    = NEW.step_data,
        updated_at   = NEW.updated_at
    WHERE id = OLD.id;
    RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.wizard_states_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM sys.wizard_states WHERE id = OLD.id; RETURN OLD; END; $$;

CREATE TRIGGER wizard_states_insert INSTEAD OF INSERT ON public.wizard_states FOR EACH ROW EXECUTE FUNCTION public.wizard_states_insert();
CREATE TRIGGER wizard_states_update INSTEAD OF UPDATE ON public.wizard_states FOR EACH ROW EXECUTE FUNCTION public.wizard_states_update();
CREATE TRIGGER wizard_states_delete INSTEAD OF DELETE ON public.wizard_states FOR EACH ROW EXECUTE FUNCTION public.wizard_states_delete();

-- ============================================================
-- STEP 5: INSTEAD OF triggers — upload_intents
-- ============================================================
CREATE OR REPLACE FUNCTION public.upload_intents_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN INSERT INTO sys.upload_intents VALUES (NEW.*); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.upload_intents_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE sys.upload_intents
    SET status     = NEW.status,
        file_key   = NEW.file_key,
        updated_at = NEW.updated_at
    WHERE id = OLD.id;
    RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.upload_intents_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM sys.upload_intents WHERE id = OLD.id; RETURN OLD; END; $$;

CREATE TRIGGER upload_intents_insert INSTEAD OF INSERT ON public.upload_intents FOR EACH ROW EXECUTE FUNCTION public.upload_intents_insert();
CREATE TRIGGER upload_intents_update INSTEAD OF UPDATE ON public.upload_intents FOR EACH ROW EXECUTE FUNCTION public.upload_intents_update();
CREATE TRIGGER upload_intents_delete INSTEAD OF DELETE ON public.upload_intents FOR EACH ROW EXECUTE FUNCTION public.upload_intents_delete();

-- Comments
COMMENT ON VIEW public.users          IS 'Bridge view → sys.users';
COMMENT ON VIEW public.wizard_states  IS 'Bridge view → sys.wizard_states';
COMMENT ON VIEW public.upload_intents IS 'Bridge view → sys.upload_intents';
