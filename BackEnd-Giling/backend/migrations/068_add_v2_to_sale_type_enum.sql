-- Migration 068: Add 'v2' to sale_type_enum

DO $$ 
BEGIN
    -- Add 'v2' to sale_type_enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'sale_type_enum' AND e.enumlabel = 'v2') THEN
        ALTER TYPE sale_type_enum ADD VALUE 'v2';
    END IF;
END $$;
