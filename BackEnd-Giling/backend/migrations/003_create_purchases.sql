-- Migration 003: Create purchases table
DO $$ BEGIN
    CREATE TYPE kualitas_gabah AS ENUM ('jelek', 'biasa', 'bagus', 'sangat_bagus');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    nama VARCHAR(255) NOT NULL,
    tanggal_belanja DATE,
    calo VARCHAR(255) NOT NULL,
    harga_per_kg DECIMAL(10, 2) NOT NULL,
    total_harga DECIMAL(12, 2),
    lokasi_belanja VARCHAR(255) NOT NULL,
    koordinat VARCHAR(100),
    berat_gabah_kg DECIMAL(10, 2) NOT NULL,
    jenis_gabah VARCHAR(100) NOT NULL,
    kadar_air DECIMAL(5, 2),
    kadar_hampa DECIMAL(5, 2),
    kualitas_gabah kualitas_gabah NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_berat_gabah_positive CHECK (berat_gabah_kg > 0),
    CONSTRAINT check_harga_per_kg_positive CHECK (harga_per_kg > 0)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_purchases_batch_id ON purchases(batch_id);
CREATE INDEX IF NOT EXISTS idx_purchases_tanggal_belanja ON purchases(tanggal_belanja);

-- Apply updated_at trigger
DROP TRIGGER IF EXISTS update_purchases_updated_at ON purchases;
CREATE TRIGGER update_purchases_updated_at BEFORE UPDATE ON purchases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-calculate total_harga if not provided
CREATE OR REPLACE FUNCTION calculate_purchase_total_harga()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.total_harga IS NULL THEN
        NEW.total_harga = NEW.berat_gabah_kg * NEW.harga_per_kg;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS calculate_purchase_total ON purchases;
CREATE TRIGGER calculate_purchase_total BEFORE INSERT OR UPDATE ON purchases
    FOR EACH ROW EXECUTE FUNCTION calculate_purchase_total_harga();

-- Update batch total_qty_kg and remaining_kg when purchase is inserted/updated/deleted
CREATE OR REPLACE FUNCTION update_batch_quantities()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE batches 
        SET total_qty_kg = total_qty_kg - OLD.berat_gabah_kg,
            remaining_kg = remaining_kg - OLD.berat_gabah_kg
        WHERE id = OLD.batch_id;
        RETURN OLD;
    ELSIF TG_OP = 'INSERT' THEN
        UPDATE batches 
        SET total_qty_kg = total_qty_kg + NEW.berat_gabah_kg,
            remaining_kg = remaining_kg + NEW.berat_gabah_kg
        WHERE id = NEW.batch_id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE batches 
        SET total_qty_kg = total_qty_kg - OLD.berat_gabah_kg + NEW.berat_gabah_kg,
            remaining_kg = remaining_kg - OLD.berat_gabah_kg + NEW.berat_gabah_kg
        WHERE id = NEW.batch_id;
        RETURN NEW;
    END IF;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_batch_on_purchase_change ON purchases;
CREATE TRIGGER update_batch_on_purchase_change AFTER INSERT OR UPDATE OR DELETE ON purchases
    FOR EACH ROW EXECUTE FUNCTION update_batch_quantities();
