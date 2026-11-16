CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Migration 010: Create log_history table
CREATE TABLE IF NOT EXISTS log_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),  -- ← Pakai UUID! 
    user_id UUID,  -- No foreign key since log_history is in separate database
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    old_data JSONB,
    new_data JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_log_history_user_id ON log_history(user_id);
CREATE INDEX IF NOT EXISTS idx_log_history_entity ON log_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_log_history_action ON log_history(action);
CREATE INDEX IF NOT EXISTS idx_log_history_created_at ON log_history(created_at);
