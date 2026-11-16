-- 1. Create audit logging database
CREATE DATABASE gabah_logs;
GRANT ALL PRIVILEGES ON DATABASE gabah_logs TO gabah_user;

-- 2. Create restricted application runtime role (Non-superuser, CRUD only)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'gabah_app_user') THEN
        CREATE ROLE gabah_app_user WITH LOGIN PASSWORD 'gabah_app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
    END IF;
END
$$;

-- Grant database connection permissions
GRANT CONNECT ON DATABASE gabah_db TO gabah_app_user;
GRANT CONNECT ON DATABASE gabah_logs TO gabah_app_user;

-- Grant schema USAGE and CRUD table permissions on public schema
GRANT USAGE ON SCHEMA public TO gabah_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO gabah_app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO gabah_app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO gabah_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO gabah_app_user;
