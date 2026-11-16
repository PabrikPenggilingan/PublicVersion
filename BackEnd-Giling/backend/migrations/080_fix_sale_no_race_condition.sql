-- Migration 080: Fix sale_no race condition using transaction sequence table

-- 1. Create the sequence table to track current sequence per prefix
CREATE TABLE IF NOT EXISTS trx.transaction_sequences (
    prefix VARCHAR(50) PRIMARY KEY,
    last_seq INT NOT NULL DEFAULT 0
);

-- 2. Safely Update the trigger function
CREATE OR REPLACE FUNCTION generate_sale_no()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_year      TEXT;
    v_month     TEXT;
    v_seq       INT;
    v_sale_no   TEXT;
    v_prefix    TEXT;
    v_max_seq   INT;
BEGIN
    -- Only generate if not already set by manual input
    IF NEW.sale_no IS NOT NULL THEN
        RETURN NEW;
    END IF;

    v_year  := TO_CHAR(NEW.sale_date, 'YYYY');
    v_month := TO_CHAR(NEW.sale_date, 'MM');
    v_prefix := 'JUAL/' || v_year || '/' || v_month;

    -- Attempt atomic increment with row-level lock
    UPDATE trx.transaction_sequences
    SET last_seq = last_seq + 1
    WHERE prefix = v_prefix
    RETURNING last_seq INTO v_seq;

    -- If prefix didn't exist yet, we initialize it
    IF v_seq IS NULL THEN
        -- Find the maximum sequence already used in sales for this prefix (handling existing data)
        SELECT COALESCE(MAX(NULLIF(regexp_replace(sale_no, '^.*/([0-9]+)$', '\1'), sale_no)::INT), 0)
        INTO v_max_seq
        FROM sales
        WHERE sale_no LIKE v_prefix || '/%';

        -- Upsert atomic increment
        INSERT INTO trx.transaction_sequences (prefix, last_seq)
        VALUES (v_prefix, v_max_seq + 1)
        ON CONFLICT (prefix) DO UPDATE
        SET last_seq = trx.transaction_sequences.last_seq + 1
        RETURNING last_seq INTO v_seq;
    END IF;

    -- Format the sequence
    v_sale_no := v_prefix || '/' || LPAD(v_seq::TEXT, 3, '0');
    NEW.sale_no := v_sale_no;
    RETURN NEW;
END;
$$;
