-- Migration 005: Create process_batches table
CREATE TABLE IF NOT EXISTS process_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    qty_used_kg DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_qty_used_positive CHECK (qty_used_kg > 0),
    CONSTRAINT unique_process_batch UNIQUE (process_id, batch_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_process_batches_process_id ON process_batches(process_id);
CREATE INDEX IF NOT EXISTS idx_process_batches_batch_id ON process_batches(batch_id);

-- Update process total_input_kg when process_batch is inserted/updated/deleted
CREATE OR REPLACE FUNCTION update_process_total_input()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE processes 
        SET total_input_kg = total_input_kg - OLD.qty_used_kg
        WHERE id = OLD.process_id;
        RETURN OLD;
    ELSIF TG_OP = 'INSERT' THEN
        UPDATE processes 
        SET total_input_kg = total_input_kg + NEW.qty_used_kg
        WHERE id = NEW.process_id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE processes 
        SET total_input_kg = total_input_kg - OLD.qty_used_kg + NEW.qty_used_kg
        WHERE id = NEW.process_id;
        RETURN NEW;
    END IF;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_process_on_batch_change ON process_batches;
CREATE TRIGGER update_process_on_batch_change AFTER INSERT OR UPDATE OR DELETE ON process_batches
    FOR EACH ROW EXECUTE FUNCTION update_process_total_input();

-- Update batch remaining_kg when process_batch is inserted/updated/deleted
CREATE OR REPLACE FUNCTION update_batch_remaining()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE batches 
        SET remaining_kg = remaining_kg + OLD.qty_used_kg
        WHERE id = OLD.batch_id;
        RETURN OLD;
    ELSIF TG_OP = 'INSERT' THEN
        UPDATE batches 
        SET remaining_kg = remaining_kg - NEW.qty_used_kg
        WHERE id = NEW.batch_id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE batches 
        SET remaining_kg = remaining_kg + OLD.qty_used_kg - NEW.qty_used_kg
        WHERE id = NEW.batch_id;
        RETURN NEW;
    END IF;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_batch_on_process_batch_change ON process_batches;
CREATE TRIGGER update_batch_on_process_batch_change AFTER INSERT OR UPDATE OR DELETE ON process_batches
    FOR EACH ROW EXECUTE FUNCTION update_batch_remaining();

-- Auto-close batch when remaining_kg <= 0
CREATE OR REPLACE FUNCTION auto_close_batch()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.remaining_kg <= 0 AND NEW.status = 'OPEN' THEN
        NEW.status = 'CLOSED';
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS auto_close_batch_trigger ON batches;
CREATE TRIGGER auto_close_batch_trigger BEFORE UPDATE ON batches
    FOR EACH ROW EXECUTE FUNCTION auto_close_batch();

-- Validate batch has enough remaining_kg before inserting process_batch
CREATE OR REPLACE FUNCTION validate_batch_availability()
RETURNS TRIGGER AS $$
DECLARE
    available_kg DECIMAL(10, 2);
BEGIN
    SELECT remaining_kg INTO available_kg FROM batches WHERE id = NEW.batch_id;
    
    IF available_kg < NEW.qty_used_kg THEN
        RAISE EXCEPTION 'Batch does not have enough remaining quantity. Available: % kg, Requested: % kg', 
            available_kg, NEW.qty_used_kg;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS validate_batch_availability_trigger ON process_batches;
CREATE TRIGGER validate_batch_availability_trigger BEFORE INSERT OR UPDATE ON process_batches
    FOR EACH ROW EXECUTE FUNCTION validate_batch_availability();
