-- Migration 035: Move log_history → log.activity schema
-- Strategy: NON-BREAKING view-bridge. Existing backend code continues to work unchanged.
-- The log schema was created in migration 034.

-- ============================================================
-- STEP 0: Ensure log schema exists in this database
-- ============================================================
CREATE SCHEMA IF NOT EXISTS log;

-- ============================================================
-- STEP 1: Move log_history to log schema and rename to activity
-- ============================================================
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'log_history') THEN
        ALTER TABLE public.log_history SET SCHEMA log;
        ALTER TABLE log.log_history RENAME TO activity;
    END IF;
END $$;

-- ============================================================
-- STEP 2: Create a compatibility view in public so existing
--         backend code still resolves 'log_history' without changes.
-- ============================================================
CREATE VIEW public.log_history AS
    SELECT * FROM log.activity;

-- ============================================================
-- STEP 3: Create INSTEAD OF INSERT trigger so INSERTs via the
--         view are forwarded to the actual table.
--         (log_history is append-only; no UPDATE/DELETE needed)
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_history_insert_bridge()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO log.activity (
        id, user_id, action, entity_type, entity_id,
        old_data, new_data, ip_address, user_agent, created_at
    ) VALUES (
        NEW.id, NEW.user_id, NEW.action, NEW.entity_type, NEW.entity_id,
        NEW.old_data, NEW.new_data, NEW.ip_address, NEW.user_agent,
        COALESCE(NEW.created_at, CURRENT_TIMESTAMP)
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER log_history_insert_bridge
    INSTEAD OF INSERT ON public.log_history
    FOR EACH ROW EXECUTE FUNCTION public.log_history_insert_bridge();

-- ============================================================
-- STEP 4: Update indexes on the real table (now in log schema)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_log_activity_user_id ON log.activity(user_id);
CREATE INDEX IF NOT EXISTS idx_log_activity_entity ON log.activity(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_log_activity_action ON log.activity(action);
CREATE INDEX IF NOT EXISTS idx_log_activity_created_at ON log.activity(created_at DESC);

COMMENT ON TABLE log.activity IS 'Audit trail for all user actions. Moved from public.log_history in migration 035.';
COMMENT ON VIEW public.log_history IS 'Compatibility bridge view → log.activity. Forwards INSERTs via trigger.';
