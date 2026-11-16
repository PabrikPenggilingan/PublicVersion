-- Migration 066: Setup Restricted DB Application User
-- Creates dedicated app runtime user with restricted CRUD permissions (No SUPERUSER / CREATEDB / DDL rights)

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'gabah_app_user') THEN
        CREATE ROLE gabah_app_user WITH LOGIN PASSWORD 'gabah_app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
    END IF;
END
$$;

-- Grant database connection permissions dynamically based on current DB
DO $$
BEGIN
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO gabah_app_user', current_database());
END
$$;

-- Grant schema USAGE and CRUD table permissions on public, sys, and trx schemas
GRANT USAGE ON SCHEMA public TO gabah_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO gabah_app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO gabah_app_user;

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.schemata WHERE schema_name = 'sys') THEN
        GRANT USAGE ON SCHEMA sys TO gabah_app_user;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sys TO gabah_app_user;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA sys TO gabah_app_user;
        ALTER DEFAULT PRIVILEGES IN SCHEMA sys GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO gabah_app_user;
        ALTER DEFAULT PRIVILEGES IN SCHEMA sys GRANT USAGE, SELECT ON SEQUENCES TO gabah_app_user;
    END IF;

    IF EXISTS (SELECT FROM information_schema.schemata WHERE schema_name = 'trx') THEN
        GRANT USAGE ON SCHEMA trx TO gabah_app_user;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA trx TO gabah_app_user;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA trx TO gabah_app_user;
        ALTER DEFAULT PRIVILEGES IN SCHEMA trx GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO gabah_app_user;
        ALTER DEFAULT PRIVILEGES IN SCHEMA trx GRANT USAGE, SELECT ON SEQUENCES TO gabah_app_user;
    END IF;
END
$$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO gabah_app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO gabah_app_user;
