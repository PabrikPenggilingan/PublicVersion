-- Migration 022: Create drying_links table
CREATE TABLE IF NOT EXISTS drying_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drying_id UUID NOT NULL REFERENCES drying_processes(id) ON DELETE CASCADE,
    link_code VARCHAR(20) NOT NULL UNIQUE,
    employee_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_drying_links_link_code ON drying_links(link_code);
CREATE INDEX IF NOT EXISTS idx_drying_links_drying_id ON drying_links(drying_id);

COMMENT ON TABLE drying_links IS 'Shareable form links for field employees';
