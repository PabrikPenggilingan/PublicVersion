const db = require('./src/config/database');

async function run() {
    try {
        console.log("Adding CANCELLED to process_status...");
        await db.query(`ALTER TYPE process_status ADD VALUE IF NOT EXISTS 'CANCELLED'`);
        console.log("Successfully added CANCELLED to process_status enum (default schema)");
    } catch (e) {
        console.error("Error adding to default schema:", e.message);
    }

    try {
        await db.query(`ALTER TYPE trx.process_status ADD VALUE IF NOT EXISTS 'CANCELLED'`);
        console.log("Successfully added CANCELLED to trx.process_status enum");
    } catch (e) {
        console.error("Error adding to trx schema:", e.message);
    }
    process.exit(0);
}

run();
