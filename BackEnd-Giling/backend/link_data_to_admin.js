const db = require('./src/config/database');
const { usersModel } = require('./src/models');

async function linkData() {
    const client = await db.getClient();
    try {
        const adminUser = await client.query("SELECT id FROM sys.users WHERE role = 'admin' LIMIT 1");
        if (adminUser.rows.length === 0) {
            console.log("No admin user found.");
            return;
        }
        const adminId = adminUser.rows[0].id;
        console.log("Admin ID:", adminId);

        const tables = [
            'trx.inventory_items',
            'trx.sales',
            'trx.processes',
            'trx.purchases',
            'trx.batches',
            'trx.pendataan_gabah',
            'trx.finance_transactions'
        ];
        
        for (const table of tables) {
            try {
                // Determine column name
                const colName = table === 'trx.purchases' || table === 'trx.pendataan_gabah' ? 'filled_by' : 'created_by';
                
                await client.query(`UPDATE ${table} SET ${colName} = $1 WHERE ${colName} IS NULL`, [adminId]);
                console.log(`Linked ${table} to admin.`);
            } catch (err) {
                console.log(`Failed for ${table}: ${err.message}`);
            }
        }
        
        console.log("Done linking data.");
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
    }
}

linkData().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
