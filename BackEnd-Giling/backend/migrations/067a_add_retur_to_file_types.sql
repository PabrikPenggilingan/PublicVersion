-- Migration 067: Add 'retur' to file_type_enum

DO $$ 
BEGIN
    -- Add 'retur' to file_type_enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'file_type_enum' AND e.enumlabel = 'retur') THEN
        ALTER TYPE file_type_enum ADD VALUE 'retur';
    END IF;
END $$;
