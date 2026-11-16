-- Migration 062: Create Logistics Tasks
-- Table for tracking transport operational costs and details

CREATE TABLE IF NOT EXISTS trx.logistics_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_type VARCHAR(50) NOT NULL CHECK (reference_type IN ('PURCHASE', 'SALE')),
    reference_id UUID NOT NULL, -- points to trx.purchases or trx.sales_v2
    driver_name VARCHAR(255) NOT NULL,
    crew_names TEXT,
    origin VARCHAR(255),
    destination VARCHAR(255),
    duration_hours NUMERIC(5,2),
    operational_cost DECIMAL NOT NULL DEFAULT 0,
    finance_transaction_id UUID REFERENCES trx.finance_transactions(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'COMPLETED', -- Simplified for pendataan context
    notes TEXT,
    created_by UUID REFERENCES sys.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logistics_ref ON trx.logistics_tasks(reference_type, reference_id);

CREATE OR REPLACE FUNCTION public.logistics_tasks_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS update_logistics_tasks_updated_at ON trx.logistics_tasks;
CREATE TRIGGER update_logistics_tasks_updated_at BEFORE UPDATE ON trx.logistics_tasks
FOR EACH ROW EXECUTE FUNCTION public.logistics_tasks_update();
