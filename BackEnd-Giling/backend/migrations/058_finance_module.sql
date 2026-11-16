-- Migration 058: Finance Module
-- Tables for Cash Management, Debt (AP), Overhead, and Transactions

-- 1. Add privilege_level to users
ALTER TABLE sys.users ADD COLUMN IF NOT EXISTS privilege_level VARCHAR(20) DEFAULT 'BASIC';
-- Update existing admin to high privilege
UPDATE sys.users SET privilege_level = 'TIER_B' WHERE role = 'admin';

-- 2. Finance Accounts (Cash/Bank)
CREATE TABLE IF NOT EXISTS trx.finance_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL, -- e.g., 'Kas Pabrik', 'Kas Kantor'
    account_type VARCHAR(50) NOT NULL, -- 'CASH', 'BANK', 'CAPITAL'
    balance DECIMAL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed Initial Accounts
INSERT INTO trx.finance_accounts (name, account_type) VALUES 
('Kas Pabrik', 'CASH'),
('Modal Pemilik', 'CAPITAL')
ON CONFLICT DO NOTHING;

-- 3. Purchase Payments (Debt Management)
CREATE TABLE IF NOT EXISTS trx.purchase_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID NOT NULL REFERENCES trx.purchases(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount DECIMAL NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(50) DEFAULT 'CASH',
    reference_no VARCHAR(100),
    notes TEXT,
    created_by UUID REFERENCES sys.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add debt-related columns to purchases (not changing flow, just tracking)
ALTER TABLE trx.purchases ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'UNPAID';
ALTER TABLE trx.purchases ADD COLUMN IF NOT EXISTS paid_amount DECIMAL DEFAULT 0;
ALTER TABLE trx.purchases ADD COLUMN IF NOT EXISTS due_date DATE;

-- 4. Overhead Expenses
CREATE TABLE IF NOT EXISTS trx.overhead_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    category VARCHAR(100) NOT NULL, -- e.g., 'Maintenance', 'Gaji', 'Listrik'
    description TEXT,
    amount DECIMAL NOT NULL CHECK (amount > 0),
    frequency VARCHAR(20) DEFAULT 'DAILY', -- 'DAILY', 'WEEKLY', 'MONTHLY'
    payment_method VARCHAR(50) DEFAULT 'CASH',
    finance_account_id UUID REFERENCES trx.finance_accounts(id),
    created_by UUID REFERENCES sys.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Calo Payouts (Commision Tracking)
CREATE TABLE IF NOT EXISTS trx.calo_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calo_name VARCHAR(100) NOT NULL,
    purchase_id UUID REFERENCES trx.purchases(id) ON DELETE SET NULL,
    amount DECIMAL NOT NULL,
    payout_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'PAID',
    notes TEXT,
    created_by UUID REFERENCES sys.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. General Ledger (Finance Transactions)
CREATE TABLE IF NOT EXISTS trx.finance_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    account_id UUID REFERENCES trx.finance_accounts(id),
    transaction_type VARCHAR(20) NOT NULL, -- 'IN', 'OUT'
    amount DECIMAL NOT NULL,
    category VARCHAR(100), -- 'SALE', 'PURCHASE', 'OVERHEAD', 'CAPITAL_IN', 'CALO_PAYOUT'
    reference_id UUID, -- id from sales, purchases, or overhead
    description TEXT,
    created_by UUID REFERENCES sys.users(id)
);
