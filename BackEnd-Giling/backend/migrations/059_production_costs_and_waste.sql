-- Migration 059: Production Costs Enhancement & Waste Management

-- 1. Drying Cost Tracking
CREATE TABLE IF NOT EXISTS trx.drying_costs (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    drying_id   UUID        NOT NULL REFERENCES trx.drying_processes(id) ON DELETE CASCADE,
    cost_type   VARCHAR(50) NOT NULL CHECK (cost_type IN ('LABOR', 'FUEL', 'TRANSPORT', 'OTHER')),
    description VARCHAR(255),
    amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
    finance_transaction_id UUID, -- Link to cash out
    created_by  UUID        REFERENCES sys.users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add Waste Tracking to Drying
ALTER TABLE trx.drying_sessions 
ADD COLUMN IF NOT EXISTS waste_kg NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS waste_reason TEXT;

-- 3. Add Waste Tracking to Milling
ALTER TABLE trx.processes 
ADD COLUMN IF NOT EXISTS waste_kg NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS waste_reason TEXT;

-- 4. Enhance Process Costs with Finance Link
ALTER TABLE trx.process_costs
ADD COLUMN IF NOT EXISTS finance_transaction_id UUID;

-- 5. Add HPP columns to Drying (to track capital value of GKG)
ALTER TABLE trx.drying_sessions
ADD COLUMN IF NOT EXISTS hpp_per_kg NUMERIC(12,2) DEFAULT 0;

-- 6. Update Public Views
DROP VIEW IF EXISTS public.drying_sessions CASCADE;
CREATE VIEW public.drying_sessions AS SELECT * FROM trx.drying_sessions;

DROP VIEW IF EXISTS public.processes CASCADE;
CREATE VIEW public.processes AS SELECT * FROM trx.processes;
