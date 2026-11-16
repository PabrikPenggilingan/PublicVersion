-- Migration 084: Add accessible_modules to users, add 'owner' role

-- Add 'owner' to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'owner';

-- Add accessible_modules column
ALTER TABLE sys.users ADD COLUMN IF NOT EXISTS accessible_modules JSONB DEFAULT '["DASHBOARD", "PURCHASES", "PENDATAAN", "DRYING", "INVENTORY", "PROCESSES", "SALES", "LOGISTICS", "FINANCE", "AI_ANALYSIS", "LOGS", "SETTINGS"]'::jsonb;

-- Recreate view and triggers for public.users
DROP VIEW IF EXISTS public.users CASCADE;

CREATE VIEW public.users AS SELECT * FROM sys.users;

CREATE OR REPLACE FUNCTION public.users_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO sys.users (id, username, password_hash, role, created_at, updated_at, accessible_modules)
    VALUES (
        COALESCE(NEW.id, uuid_generate_v4()),
        NEW.username,
        NEW.password_hash,
        NEW.role,
        COALESCE(NEW.created_at, CURRENT_TIMESTAMP),
        COALESCE(NEW.updated_at, CURRENT_TIMESTAMP),
        COALESCE(NEW.accessible_modules, '["DASHBOARD", "PURCHASES", "PENDATAAN", "DRYING", "INVENTORY", "PROCESSES", "SALES", "LOGISTICS", "FINANCE", "AI_ANALYSIS", "LOGS", "SETTINGS"]'::jsonb)
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
        updated_at = NEW.updated_at,
        accessible_modules = NEW.accessible_modules
    WHERE id = OLD.id;
    RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.users_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM sys.users WHERE id = OLD.id; RETURN OLD; END; $$;

CREATE TRIGGER users_insert INSTEAD OF INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.users_insert();
CREATE TRIGGER users_update INSTEAD OF UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.users_update();
CREATE TRIGGER users_delete INSTEAD OF DELETE ON public.users FOR EACH ROW EXECUTE FUNCTION public.users_delete();

COMMENT ON VIEW public.users IS 'Bridge view → sys.users';
