-- Migration 086: Update process_costs cost_type constraint

ALTER TABLE trx.process_costs DROP CONSTRAINT IF EXISTS process_costs_cost_type_check;

ALTER TABLE trx.process_costs ADD CONSTRAINT process_costs_cost_type_check 
CHECK (cost_type IN ('GILING', 'PACKAGING', 'UTILITY', 'LABOR', 'TRANSPORT', 'KONSUMSI', 'OTHER'));
