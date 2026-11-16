-- Migration 020: Create drying_sessions table
CREATE TABLE IF NOT EXISTS drying_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drying_id UUID NOT NULL REFERENCES drying_processes(id) ON DELETE CASCADE,
    session_type VARCHAR(10) NOT NULL CHECK (session_type IN ('START', 'END')),
    pic VARCHAR(255) NOT NULL,
    people_involved TEXT,
    session_date DATE NOT NULL,
    session_time TIME NOT NULL,
    moisture_content DECIMAL(5,2),
    button_pressed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(drying_id, session_type)
);

CREATE INDEX IF NOT EXISTS idx_drying_sessions_drying_id ON drying_sessions(drying_id);

COMMENT ON TABLE drying_sessions IS 'Stores start and end session data for drying process';
COMMENT ON COLUMN drying_sessions.session_type IS 'START = before drying, END = after drying';
COMMENT ON COLUMN drying_sessions.moisture_content IS 'Kadar air (moisture content) in percentage';
COMMENT ON COLUMN drying_sessions.button_pressed_at IS 'Timestamp when user pressed the action button';
