const db = require('./config/database');

const sql = `
CREATE OR REPLACE FUNCTION sys.check_financial_lock()
RETURNS TRIGGER AS $$
DECLARE
    v_lock_date DATE;
    v_doc_date DATE;
    v_old_doc_date DATE;
BEGIN
    -- Get the lock date
    SELECT setting_value_date INTO v_lock_date
    FROM sys.system_settings
    WHERE setting_key = 'FINANCIAL_LOCK_DATE';

    -- If no lock date is set, allow all
    IF v_lock_date IS NULL THEN
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;

    -- For DELETE and UPDATE, check the OLD date first
    IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
        IF TG_TABLE_NAME = 'sales' THEN v_old_doc_date := DATE(OLD.sale_date);
        ELSIF TG_TABLE_NAME = 'purchases' THEN v_old_doc_date := DATE(OLD.tanggal_belanja);
        ELSIF TG_TABLE_NAME = 'finance_transactions' THEN v_old_doc_date := DATE(OLD.transaction_date);
        ELSIF TG_TABLE_NAME = 'inventory_transactions' THEN v_old_doc_date := DATE(OLD.created_at);
        ELSIF TG_TABLE_NAME = 'sale_payments' THEN v_old_doc_date := DATE(OLD.payment_date);
        ELSIF TG_TABLE_NAME = 'purchase_payments' THEN v_old_doc_date := DATE(OLD.payment_date);
        ELSIF TG_TABLE_NAME = 'sale_returns' THEN v_old_doc_date := DATE(OLD.return_date);
        ELSIF TG_TABLE_NAME = 'overhead_expenses' THEN v_old_doc_date := DATE(OLD.expense_date);
        ELSE v_old_doc_date := DATE(OLD.created_at);
        END IF;
        
        IF v_old_doc_date <= v_lock_date THEN
            RAISE EXCEPTION 'Periode finansial telah dikunci hingga %. Data historis tidak dapat diubah/dihapus.', v_lock_date;
        END IF;
    END IF;

    -- For INSERT and UPDATE, check the NEW date
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF TG_TABLE_NAME = 'sales' THEN v_doc_date := DATE(NEW.sale_date);
        ELSIF TG_TABLE_NAME = 'purchases' THEN v_doc_date := DATE(NEW.tanggal_belanja);
        ELSIF TG_TABLE_NAME = 'finance_transactions' THEN v_doc_date := DATE(NEW.transaction_date);
        ELSIF TG_TABLE_NAME = 'inventory_transactions' THEN v_doc_date := DATE(NEW.created_at);
        ELSIF TG_TABLE_NAME = 'sale_payments' THEN v_doc_date := DATE(NEW.payment_date);
        ELSIF TG_TABLE_NAME = 'purchase_payments' THEN v_doc_date := DATE(NEW.payment_date);
        ELSIF TG_TABLE_NAME = 'sale_returns' THEN v_doc_date := DATE(NEW.return_date);
        ELSIF TG_TABLE_NAME = 'overhead_expenses' THEN v_doc_date := DATE(NEW.expense_date);
        ELSE v_doc_date := DATE(NEW.created_at);
        END IF;

        IF v_doc_date <= v_lock_date THEN
            RAISE EXCEPTION 'Periode finansial telah dikunci hingga %. Tidak dapat memasukkan/mengubah data pada tanggal tersebut.', v_lock_date;
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`;

db.query(sql).then(() => {
    console.log("Trigger sys.check_financial_lock updated successfully.");
}).catch(e => {
    console.error("Failed to update trigger:", e);
});
