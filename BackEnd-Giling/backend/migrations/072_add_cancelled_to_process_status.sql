-- Migration 072: Add CANCELLED to process_status enum
DO $$ BEGIN
    ALTER TYPE process_status ADD VALUE IF NOT EXISTS 'CANCELLED';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
