-- Migration 004: Create processes table
DO $$ BEGIN
    CREATE TYPE process_status AS ENUM ('IN_PROGRESS', 'COMPLETED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS processes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    process_date DATE NOT NULL,
    end_date DATE,
    status process_status NOT NULL DEFAULT 'IN_PROGRESS',
    total_input_kg DECIMAL(10, 2) DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_end_date_after_process_date CHECK (end_date IS NULL OR end_date >= process_date),
    CONSTRAINT check_max_duration CHECK (end_date IS NULL OR end_date <= process_date + INTERVAL '2 days')
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_processes_status ON processes(status);
CREATE INDEX IF NOT EXISTS idx_processes_process_date ON processes(process_date);
CREATE INDEX IF NOT EXISTS idx_processes_created_by ON processes(created_by);

-- Apply updated_at trigger
DROP TRIGGER IF EXISTS update_processes_updated_at ON processes;
CREATE TRIGGER update_processes_updated_at BEFORE UPDATE ON processes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
