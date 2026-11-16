-- Migration 006: Create sales tables
DO $$ BEGIN
    CREATE TYPE hasil_kualitas AS ENUM ('jelek', 'biasa', 'bagus', 'sangat_bagus');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Sales Beras (detailed)
CREATE TABLE IF NOT EXISTS sales_beras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
    nama VARCHAR(255) NOT NULL,
    tanggal_jual DATE,
    calo VARCHAR(255) NOT NULL,
    harga_jual_per_kg DECIMAL(10, 2) NOT NULL,
    harga_jual_total DECIMAL(12, 2),
    jual_kemana VARCHAR(255),
    tonase DECIMAL(10, 2) NOT NULL,
    rendemen DECIMAL(5, 2) NOT NULL,
    hasil_akhir hasil_kualitas NOT NULL,
    derajat_sosoh DECIMAL(5, 2),
    butir_patah DECIMAL(5, 2),
    butir_kepala DECIMAL(5, 2),
    kadar_air DECIMAL(5, 2),
    benda_asing DECIMAL(5, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_tonase_beras_positive CHECK (tonase > 0),
    CONSTRAINT check_harga_jual_per_kg_positive CHECK (harga_jual_per_kg > 0),
    CONSTRAINT check_rendemen_valid CHECK (rendemen >= 0 AND rendemen <= 100)
);

CREATE INDEX IF NOT EXISTS idx_sales_beras_process_id ON sales_beras(process_id);
CREATE INDEX IF NOT EXISTS idx_sales_beras_tanggal_jual ON sales_beras(tanggal_jual);

DROP TRIGGER IF EXISTS update_sales_beras_updated_at ON sales_beras;
CREATE TRIGGER update_sales_beras_updated_at BEFORE UPDATE ON sales_beras
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-calculate harga_jual_total for beras
CREATE OR REPLACE FUNCTION calculate_sales_beras_total()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.harga_jual_total IS NULL THEN
        NEW.harga_jual_total = NEW.tonase * NEW.harga_jual_per_kg;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS calculate_sales_beras_total_trigger ON sales_beras;
CREATE TRIGGER calculate_sales_beras_total_trigger BEFORE INSERT OR UPDATE ON sales_beras
    FOR EACH ROW EXECUTE FUNCTION calculate_sales_beras_total();

-- Sales Dedak (simplified)
CREATE TABLE IF NOT EXISTS sales_dedak (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
    nama VARCHAR(255) NOT NULL,
    tanggal_jual DATE,
    tonase DECIMAL(10, 2) NOT NULL,
    harga_per_kg DECIMAL(10, 2) NOT NULL,
    harga_total DECIMAL(12, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_tonase_dedak_positive CHECK (tonase > 0),
    CONSTRAINT check_harga_dedak_positive CHECK (harga_per_kg > 0)
);

CREATE INDEX IF NOT EXISTS idx_sales_dedak_process_id ON sales_dedak(process_id);

DROP TRIGGER IF EXISTS update_sales_dedak_updated_at ON sales_dedak;
CREATE TRIGGER update_sales_dedak_updated_at BEFORE UPDATE ON sales_dedak
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-calculate harga_total for dedak
CREATE OR REPLACE FUNCTION calculate_sales_simplified_total()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.harga_total IS NULL THEN
        NEW.harga_total = NEW.tonase * NEW.harga_per_kg;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS calculate_sales_dedak_total_trigger ON sales_dedak;
CREATE TRIGGER calculate_sales_dedak_total_trigger BEFORE INSERT OR UPDATE ON sales_dedak
    FOR EACH ROW EXECUTE FUNCTION calculate_sales_simplified_total();

-- Sales Sekam (simplified)
CREATE TABLE IF NOT EXISTS sales_sekam (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
    nama VARCHAR(255) NOT NULL,
    tanggal_jual DATE,
    tonase DECIMAL(10, 2) NOT NULL,
    harga_per_kg DECIMAL(10, 2) NOT NULL,
    harga_total DECIMAL(12, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_tonase_sekam_positive CHECK (tonase > 0),
    CONSTRAINT check_harga_sekam_positive CHECK (harga_per_kg > 0)
);

CREATE INDEX IF NOT EXISTS idx_sales_sekam_process_id ON sales_sekam(process_id);

DROP TRIGGER IF EXISTS update_sales_sekam_updated_at ON sales_sekam;
CREATE TRIGGER update_sales_sekam_updated_at BEFORE UPDATE ON sales_sekam
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS calculate_sales_sekam_total_trigger ON sales_sekam;
CREATE TRIGGER calculate_sales_sekam_total_trigger BEFORE INSERT OR UPDATE ON sales_sekam
    FOR EACH ROW EXECUTE FUNCTION calculate_sales_simplified_total();

-- Sales Menir (simplified)
CREATE TABLE IF NOT EXISTS sales_menir (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
    nama VARCHAR(255) NOT NULL,
    tanggal_jual DATE,
    tonase DECIMAL(10, 2) NOT NULL,
    harga_per_kg DECIMAL(10, 2) NOT NULL,
    harga_total DECIMAL(12, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_tonase_menir_positive CHECK (tonase > 0),
    CONSTRAINT check_harga_menir_positive CHECK (harga_per_kg > 0)
);

CREATE INDEX IF NOT EXISTS idx_sales_menir_process_id ON sales_menir(process_id);

DROP TRIGGER IF EXISTS update_sales_menir_updated_at ON sales_menir;
CREATE TRIGGER update_sales_menir_updated_at BEFORE UPDATE ON sales_menir
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS calculate_sales_menir_total_trigger ON sales_menir;
CREATE TRIGGER calculate_sales_menir_total_trigger BEFORE INSERT OR UPDATE ON sales_menir
    FOR EACH ROW EXECUTE FUNCTION calculate_sales_simplified_total();

-- Sales Broken (simplified)
CREATE TABLE IF NOT EXISTS sales_broken (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
    nama VARCHAR(255) NOT NULL,
    tanggal_jual DATE,
    tonase DECIMAL(10, 2) NOT NULL,
    harga_per_kg DECIMAL(10, 2) NOT NULL,
    harga_total DECIMAL(12, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_tonase_broken_positive CHECK (tonase > 0),
    CONSTRAINT check_harga_broken_positive CHECK (harga_per_kg > 0)
);

CREATE INDEX IF NOT EXISTS idx_sales_broken_process_id ON sales_broken(process_id);

DROP TRIGGER IF EXISTS update_sales_broken_updated_at ON sales_broken;
CREATE TRIGGER update_sales_broken_updated_at BEFORE UPDATE ON sales_broken
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS calculate_sales_broken_total_trigger ON sales_broken;
CREATE TRIGGER calculate_sales_broken_total_trigger BEFORE INSERT OR UPDATE ON sales_broken
    FOR EACH ROW EXECUTE FUNCTION calculate_sales_simplified_total();
