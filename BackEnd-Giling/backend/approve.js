const db = require('./src/config/database');
const financeService = require('./src/services/finance.service');
(async () => {
    try {
        const client = await db.getClient();
        const res = await client.query('SELECT id FROM trx.journal_entries WHERE status = $1', ['PENDING']);
        const pending = res.rows;
        const accRes = await client.query('SELECT id FROM trx.finance_accounts WHERE account_code = $1', ['1-100']);
        const kasId = accRes.rows[0].id;
        console.log('Approving ' + pending.length + ' entries...');
        for(let j of pending) {
            await financeService.approveTransaction(j.id, kasId, 1);
        }
        console.log('Done!');
        process.exit(0);
    } catch(e) { console.error(e); process.exit(1); }
})();
