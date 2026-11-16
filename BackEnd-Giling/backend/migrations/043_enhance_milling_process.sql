-- Migration 043: Enhance Milling Process for Full Inventory Flow
-- - Add inventory linkage + cost tracking to processes
-- - Add packaging_size_kg to inventory_items
-- - Add 'manual' to source_type constraint
-- - Create process_costs table

-- =============================================================
-- A. Tambah kolom milling context ke trx.processes
-- =============================================================
ALTER TABLE trx.processes
  ADD COLUMN IF NOT EXISTS inventory_item_id UUID REFERENCES trx.inventory_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gabah_reserved_kg  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS gabah_used_kg      NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS sekam_kg           NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS sekam_notes        TEXT,
  ADD COLUMN IF NOT EXISTS rendemen_pct       NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS hpp_per_kg         NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS end_date           DATE;

-- =============================================================
-- B. Tabel biaya proses giling (untuk kalkulasi HPP)
-- =============================================================
CREATE TABLE IF NOT EXISTS trx.process_costs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id  UUID        NOT NULL REFERENCES trx.processes(id) ON DELETE CASCADE,
  cost_type   VARCHAR(50) NOT NULL CHECK (cost_type IN ('GILING','PACKAGING','UTILITY','LABOR','TRANSPORT','OTHER')),
  description VARCHAR(255),
  amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_by  UUID        REFERENCES sys.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_process_costs_process ON trx.process_costs(process_id);

-- =============================================================
-- C. Tambah packaging_size_kg ke trx.inventory_items
-- =============================================================
ALTER TABLE trx.inventory_items
  ADD COLUMN IF NOT EXISTS packaging_size_kg NUMERIC(6,2);

-- =============================================================
-- D. Update source_type constraint: tambah 'manual'
-- =============================================================
ALTER TABLE trx.inventory_items
  DROP CONSTRAINT IF EXISTS inventory_items_source_type_check;

ALTER TABLE trx.inventory_items
  ADD CONSTRAINT inventory_items_source_type_check
  CHECK (source_type IN ('batch', 'drying', 'process', 'manual'));

-- =============================================================
-- E. Recreate public view bridge for inventory_items
--    (karena ada kolom baru packaging_size_kg)
-- =============================================================
DROP VIEW IF EXISTS public.inventory_items CASCADE;
CREATE VIEW public.inventory_items AS SELECT * FROM trx.inventory_items;

-- Recreate INSTEAD OF triggers
CREATE OR REPLACE FUNCTION public.inventory_items_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN INSERT INTO trx.inventory_items VALUES (NEW.*); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.inventory_items_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE trx.inventory_items
    SET source_type           = NEW.source_type,
        batch_id              = NEW.batch_id,
        drying_id             = NEW.drying_id,
        process_id            = NEW.process_id,
        product_category_code = NEW.product_category_code,
        area                  = NEW.area,
        tanda                 = NEW.tanda,
        kualitas              = NEW.kualitas,
        avg_price_per_kg      = NEW.avg_price_per_kg,
        total_weight_kg       = NEW.total_weight_kg,
        remaining_weight_kg   = NEW.remaining_weight_kg,
        total_sacks           = NEW.total_sacks,
        remaining_sacks       = NEW.remaining_sacks,
        status                = NEW.status,
        entry_date            = NEW.entry_date,
        notes                 = NEW.notes,
        packaging_size_kg     = NEW.packaging_size_kg,
        created_by            = NEW.created_by,
        created_at            = NEW.created_at,
        updated_at            = NEW.updated_at
    WHERE id = OLD.id;
    RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.inventory_items_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM trx.inventory_items WHERE id = OLD.id; RETURN OLD; END; $$;

CREATE TRIGGER inventory_items_insert INSTEAD OF INSERT ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.inventory_items_insert();
CREATE TRIGGER inventory_items_update INSTEAD OF UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.inventory_items_update();
CREATE TRIGGER inventory_items_delete INSTEAD OF DELETE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.inventory_items_delete();

COMMENT ON VIEW public.inventory_items IS 'Bridge view → trx.inventory_items (Updated in 043: packaging_size_kg added)';

-- =============================================================
-- F. Recreate public view bridge for processes
--    (karena ada kolom baru di trx.processes)
-- =============================================================
DROP VIEW IF EXISTS public.processes CASCADE;
CREATE VIEW public.processes AS SELECT * FROM trx.processes;

CREATE OR REPLACE FUNCTION public.processes_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN INSERT INTO trx.processes VALUES (NEW.*); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.processes_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    UPDATE trx.processes SET
        process_date      = NEW.process_date,
        end_date          = NEW.end_date,
        status            = NEW.status,
        notes             = NEW.notes,
        created_by        = NEW.created_by,
        inventory_item_id = NEW.inventory_item_id,
        gabah_reserved_kg = NEW.gabah_reserved_kg,
        gabah_used_kg     = NEW.gabah_used_kg,
        sekam_kg          = NEW.sekam_kg,
        sekam_notes       = NEW.sekam_notes,
        rendemen_pct      = NEW.rendemen_pct,
        hpp_per_kg        = NEW.hpp_per_kg,
        updated_at        = NEW.updated_at
    WHERE id = OLD.id;
    RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.processes_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN DELETE FROM trx.processes WHERE id = OLD.id; RETURN OLD; END; $$;

CREATE TRIGGER processes_insert INSTEAD OF INSERT ON public.processes FOR EACH ROW EXECUTE FUNCTION public.processes_insert();
CREATE TRIGGER processes_update INSTEAD OF UPDATE ON public.processes FOR EACH ROW EXECUTE FUNCTION public.processes_update();
CREATE TRIGGER processes_delete INSTEAD OF DELETE ON public.processes FOR EACH ROW EXECUTE FUNCTION public.processes_delete();

COMMENT ON VIEW public.processes IS 'Bridge view → trx.processes (Updated in 043: milling context columns added)';
