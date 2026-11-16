-- Migration 021: Create drying_photos table
CREATE TABLE IF NOT EXISTS drying_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES drying_sessions(id) ON DELETE CASCADE,
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_drying_photos_session_id ON drying_photos(session_id);

COMMENT ON TABLE drying_photos IS 'Photos for drying sessions (1-3 per session)';
