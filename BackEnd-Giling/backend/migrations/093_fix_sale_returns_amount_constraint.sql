-- Migration 093: Allow amount_adjusted = 0 on sale returns
-- Item returns are stored with amount_adjusted = 0 because the invoice total already
-- drops when qty_ordered is reduced. Migration 051 required amount_adjusted > 0,
-- which made every item return fail with a 23514 check violation (HTTP 422).

ALTER TABLE trx.sale_returns DROP CONSTRAINT IF EXISTS chk_return_amount_positive;
ALTER TABLE trx.sale_returns ADD CONSTRAINT chk_return_amount_positive CHECK (amount_adjusted >= 0);
