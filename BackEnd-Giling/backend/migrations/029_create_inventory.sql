-- Migration 029: Create inventory system tables

-- Main inventory items table
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Source info
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('batch', 'drying')),
    batch_id UUID REFERENCES batches(id) ON DELETE SET NULL,
    drying_id UUID REFERENCES drying_processes(id) ON DELETE SET NULL,
    
    -- Location & identification
    area VARCHAR(255),
    tanda TEXT,
    
    -- Quality & pricing
    kualitas VARCHAR(50),
    avg_price_per_kg DECIMAL(12, 2),
    
    -- Tonnage (auto-calculated from sacks)
    total_weight_kg DECIMAL(12, 2) DEFAULT 0,
    remaining_weight_kg DECIMAL(12, 2) DEFAULT 0,
    
    -- Sack tracking
    total_sacks INTEGER DEFAULT 0,
    remaining_sacks INTEGER DEFAULT 0,
    
    -- Status
    status VARCHAR(20) DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'RESERVED', 'DEPLETED')),
    
    -- FIFO tracking
    entry_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Notes
    notes TEXT,
    
    -- Audit
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Individual sacks table
CREATE TABLE IF NOT EXISTS inventory_sacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    
    -- Sack info
    sack_number INTEGER NOT NULL,
    weight_kg DECIMAL(10, 2) NOT NULL,
    
    -- Withdrawal tracking
    is_taken BOOLEAN DEFAULT FALSE,
    taken_at TIMESTAMP WITH TIME ZONE,
    taken_for VARCHAR(20) CHECK (taken_for IN ('process', 'sale')),
    taken_ref_id UUID,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(inventory_item_id, sack_number)
);

-- Inventory transactions for audit trail
CREATE TABLE IF NOT EXISTS inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    
    -- Transaction type
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('IN', 'OUT', 'ADJUST')),
    
    -- Amount
    weight_kg DECIMAL(12, 2) NOT NULL,
    sack_count INTEGER DEFAULT 0,
    
    -- Reference
    reference_type VARCHAR(50),
    reference_id UUID,
    
    -- Notes
    notes TEXT,
    
    -- Audit
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for FIFO and lookups
CREATE INDEX IF NOT EXISTS idx_inventory_items_entry_date ON inventory_items(entry_date ASC);
CREATE INDEX IF NOT EXISTS idx_inventory_items_status ON inventory_items(status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_batch ON inventory_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_drying ON inventory_items(drying_id);
CREATE INDEX IF NOT EXISTS idx_inventory_sacks_item ON inventory_sacks(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_sacks_taken ON inventory_sacks(is_taken);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item ON inventory_transactions(inventory_item_id);

-- Comments
COMMENT ON TABLE inventory_items IS 'FIFO inventory items from batches or drying processes';
COMMENT ON TABLE inventory_sacks IS 'Individual sacks per inventory item with variable weights';
COMMENT ON TABLE inventory_transactions IS 'Audit trail for inventory movements';
COMMENT ON COLUMN inventory_items.entry_date IS 'Used for FIFO sorting - oldest first';
