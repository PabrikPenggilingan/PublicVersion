-- Migration 094: Close the Supabase Data API (PostgREST) hole
--
-- Problem: Supabase exposes the `public` schema over REST to the `anon` and
-- `authenticated` roles. Our 36 compatibility views in `public` (users, sales,
-- purchases, ...) are owned by postgres, run with owner rights, are auto-updatable,
-- and anon/authenticated had full grants on them. Anyone holding the project's
-- anon key could read public.users (incl. password_hash) and insert/update/delete
-- business data through https://<ref>.supabase.co/rest/v1/<view>.
--
-- The backend connects as `postgres` (owner of every table/view), so none of the
-- changes below affect it: owners keep their privileges and bypass RLS.
--
-- Guarded so it is a no-op on plain Postgres (local docker) where the Supabase
-- roles don't exist and/or security_invoker (PG15+) is unavailable.

DO $$
DECLARE
  s   text;
  v   record;
  t   record;
  has_supabase_roles boolean :=
    EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
    AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated');
BEGIN
  -- 1. Remove every table/view/sequence grant held by the API roles,
  --    and stop future objects created by postgres from getting them again.
  IF has_supabase_roles THEN
    FOREACH s IN ARRAY ARRAY['public', 'trx', 'mst', 'sys', 'log'] LOOP
      IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = s) THEN
        EXECUTE format('REVOKE ALL ON ALL TABLES    IN SCHEMA %I FROM anon, authenticated', s);
        EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA %I FROM anon, authenticated', s);
        EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I REVOKE ALL ON TABLES    FROM anon, authenticated', s);
        EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I REVOKE ALL ON SEQUENCES FROM anon, authenticated', s);
      END IF;
    END LOOP;
  END IF;

  -- 2. Views run with the caller's rights instead of the owner's
  --    (clears the "Security Definer View" advisor errors). PG15+ only.
  IF current_setting('server_version_num')::int >= 150000 THEN
    FOR v IN
      SELECT n.nspname, c.relname
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'v' AND n.nspname IN ('public', 'trx', 'mst', 'sys', 'log')
    LOOP
      EXECUTE format('ALTER VIEW %I.%I SET (security_invoker = true)', v.nspname, v.relname);
    END LOOP;
  END IF;

  -- 3. Turn on RLS for every app table (no policies = API roles see nothing).
  --    Not FORCEd, so the owner (postgres = backend) is unaffected.
  --    (clears the "RLS Disabled in Public" advisor errors)
  FOR t IN
    SELECT n.nspname, c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
      AND n.nspname IN ('public', 'trx', 'mst', 'sys', 'log')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', t.nspname, t.relname);
  END LOOP;
END $$;
