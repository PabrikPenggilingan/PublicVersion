-- Migration 007: Create files table
DO $$ BEGIN
    CREATE TYPE file_type_enum AS ENUM ('struk', 'gabah', 'proses', 'hasil');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE sale_type_enum AS ENUM ('beras', 'dedak', 'sekam', 'menir', 'broken');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID REFERENCES purchases(id) ON DELETE CASCADE,
    process_id UUID REFERENCES processes(id) ON DELETE CASCADE,
    sale_id UUID,
    sale_type sale_type_enum,
    file_type file_type_enum NOT NULL,
    r2_key VARCHAR(500) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100),
    size_bytes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_file_association CHECK (
        (purchase_id IS NOT NULL AND process_id IS NULL AND sale_id IS NULL) OR
        (purchase_id IS NULL AND process_id IS NOT NULL AND sale_id IS NULL) OR
        (purchase_id IS NULL AND process_id IS NULL AND sale_id IS NOT NULL AND sale_type IS NOT NULL)
    )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_files_purchase_id ON files(purchase_id);
CREATE INDEX IF NOT EXISTS idx_files_process_id ON files(process_id);
CREATE INDEX IF NOT EXISTS idx_files_sale_id ON files(sale_id);
CREATE INDEX IF NOT EXISTS idx_files_r2_key ON files(r2_key);
