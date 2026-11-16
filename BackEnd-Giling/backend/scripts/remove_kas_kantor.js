const db = require('../src/config/database');

async function run() {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        console.log('Mencari akun Kas Kantor...');

        const kantorRes = await client.query("SELECT * FROM trx.finance_accounts WHERE name ILIKE '%Kas Kantor%'");
        const pabrikRes = await client.query("SELECT * FROM trx.finance_accounts WHERE name ILIKE '%Kas Pabrik%'");

        if (kantorRes.rows.length === 0) {
            console.log('Kas Kantor sudah tidak ada. Melewati proses ini.');
            await client.query('COMMIT');
            return;
        }

        if (pabrikRes.rows.length === 0) {
            console.log('Kas Pabrik tidak ditemukan. Membatalkan penghapusan demi keamanan.');
            await client.query('ROLLBACK');
            return;
        }

        const kantorId = kantorRes.rows[0].id;
        const pabrikId = pabrikRes.rows[0].id;
        const kantorBalance = parseFloat(kantorRes.rows[0].balance || 0);

        console.log(`Memindahkan transaksi dari Kas Kantor (${kantorId}) ke Kas Pabrik (${pabrikId})...`);
        
        // 1. Pindahkan riwayat General Ledger (finance_transactions)
        await client.query(
            "UPDATE trx.finance_transactions SET account_id = $1 WHERE account_id = $2",
            [pabrikId, kantorId]
        );

        // 2. Pindahkan Overhead expenses yang terkait dengan Kas Kantor
        await client.query(
            "UPDATE trx.overhead_expenses SET finance_account_id = $1 WHERE finance_account_id = $2",
            [pabrikId, kantorId]
        );

        // 3. Tambahkan sisa saldo Kas Kantor ke Kas Pabrik
        if (kantorBalance > 0) {
            console.log(`Memindahkan sisa saldo Rp ${kantorBalance} ke Kas Pabrik...`);
            await client.query(
                "UPDATE trx.finance_accounts SET balance = balance + $1 WHERE id = $2",
                [kantorBalance, pabrikId]
            );
        }

        // 4. Hapus Kas Kantor
        console.log('Menghapus Kas Kantor secara permanen...');
        await client.query("DELETE FROM trx.finance_accounts WHERE id = $1", [kantorId]);

        await client.query('COMMIT');
        console.log('Pembersihan sukses!');

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Error saat pembersihan:', e);
    } finally {
        client.release();
        process.exit(0);
    }
}

run();
