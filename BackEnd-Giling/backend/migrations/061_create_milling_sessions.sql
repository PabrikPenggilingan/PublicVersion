-- Migration 061: Create Milling Session management
-- Tables for sharable form, sessions, and photos

-- 1. Milling Links (Sharable token)
CREATE TABLE IF NOT EXISTS trx.milling_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_id UUID NOT NULL REFERENCES trx.processes(id) ON DELETE CASCADE,
    link_code VARCHAR(20) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Milling Sessions (START, END, PAUSE, RESUME)
CREATE TABLE IF NOT EXISTS trx.milling_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_id UUID NOT NULL REFERENCES trx.processes(id) ON DELETE CASCADE,
    session_type VARCHAR(20) NOT NULL CHECK (session_type IN ('START', 'END', 'PAUSE', 'RESUME')),
    
    -- Operator Info
    pic VARCHAR(100),
    crew_names TEXT,
    
    -- Timestamp
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    session_time TIME NOT NULL DEFAULT CURRENT_TIME,
    
    -- QC Data (mostly for END session)
    moisture_content DECIMAL(5, 2),
    hardness_type VARCHAR(50), -- e.g. 'Keras', 'Sedang', 'Lunak'
    broken_ratio DECIMAL(5, 2), -- %
    
    -- Output Data (JSONB to support multi-packaging rows)
    -- Structure: [{category: 'BERAS', weight_kg: 500, sacks: 10, pack_size: 50}, ...]
    output_data JSONB,
    
    -- Meta
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Milling Photos
CREATE TABLE IF NOT EXISTS trx.milling_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES trx.milling_sessions(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name TEXT,
    file_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Add link reference to processes
ALTER TABLE trx.processes ADD COLUMN IF NOT EXISTS milling_link_id UUID REFERENCES trx.milling_links(id) ON DELETE SET NULL;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_milling_sessions_process ON trx.milling_sessions(process_id);
CREATE INDEX IF NOT EXISTS idx_milling_links_code ON trx.milling_links(link_code);
CREATE INDEX IF NOT EXISTS idx_milling_photos_session ON trx.milling_photos(session_id);

-- Comments
COMMENT ON TABLE trx.milling_links IS 'Sharable links for operators to record production results';
COMMENT ON TABLE trx.milling_sessions IS 'Production events (START/END) with QC and output data';
COMMENT ON COLUMN trx.milling_sessions.output_data IS 'JSON storage for flexible output rows (Beras, Menir, Dedak)';
