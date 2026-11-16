-- Migration 009: Create upload_intents table
DO $$ BEGIN
    CREATE TYPE upload_status AS ENUM ('pending', 'completed', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS upload_intents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    r2_key VARCHAR(500) NOT NULL,
    status upload_status NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_upload_intents_user_id ON upload_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_upload_intents_r2_key ON upload_intents(r2_key);
CREATE INDEX IF NOT EXISTS idx_upload_intents_status ON upload_intents(status);
CREATE INDEX IF NOT EXISTS idx_upload_intents_expires_at ON upload_intents(expires_at);
