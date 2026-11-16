-- Migration 008: Create wizard_states table
DO $$ BEGIN
    CREATE TYPE entity_type_enum AS ENUM ('batch', 'process');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS wizard_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type entity_type_enum NOT NULL,
    entity_id UUID NOT NULL,
    current_step VARCHAR(100) NOT NULL,
    step_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_entity UNIQUE (user_id, entity_type, entity_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_wizard_states_user_id ON wizard_states(user_id);
CREATE INDEX IF NOT EXISTS idx_wizard_states_entity ON wizard_states(entity_type, entity_id);

-- Apply updated_at trigger
DROP TRIGGER IF EXISTS update_wizard_states_updated_at ON wizard_states;
CREATE TRIGGER update_wizard_states_updated_at BEFORE UPDATE ON wizard_states
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
