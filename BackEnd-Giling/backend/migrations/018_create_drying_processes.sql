-- Migration 018: Create drying_processes table
CREATE TABLE IF NOT EXISTS drying_processes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_drying_processes_status ON drying_processes(status);
CREATE INDEX IF NOT EXISTS idx_drying_processes_created_at ON drying_processes(created_at DESC);

COMMENT ON TABLE drying_processes IS 'Main table for rice drying processes';
