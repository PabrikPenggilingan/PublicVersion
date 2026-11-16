const db = require('./backend/src/config/database');

async function migrateData() {
    const adminId = '3fd20552-912f-4203-b4b9-ad82adbef556';
    
    try {
        console.log('Assigning data to admin:', adminId);

        const tables = [
            'trx.batches',
            'trx.purchases',
            'trx.processes',
            'trx.sales',
            'trx.drying_processes',
            'trx.inventory_items',
            'trx.journal_entries',
            'trx.overhead_expenses',
            'trx.customers',
            'trx.logistics_tasks'
        ];

        for (const table of tables) {
            try {
                const result = await db.query(`UPDATE ${table} SET created_by = $1 WHERE created_by IS NULL OR created_by != $1`, [adminId]);
                console.log(`Updated ${result.rowCount} rows in ${table}`);
            } catch (err) {
                if (err.message.includes('column "created_by" of relation')) {
                    console.log(`Table ${table} doesn't have created_by column. Skipping.`);
                } else {
                    console.log(`Error updating ${table}:`, err.message);
                }
            }
        }
        
        console.log('Migration finished successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrateData();
