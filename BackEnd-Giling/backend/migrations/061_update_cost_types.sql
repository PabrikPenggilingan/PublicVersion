-- Migration 061: Update drying_costs cost_type constraint

ALTER TABLE trx.drying_costs DROP CONSTRAINT IF EXISTS drying_costs_cost_type_check;

ALTER TABLE trx.drying_costs ADD CONSTRAINT drying_costs_cost_type_check 
CHECK (cost_type IN ('LABOR', 'FUEL', 'TRANSPORT', 'OTHER', 'OVEN_FUEL', 'OVEN_OPERATOR'));
