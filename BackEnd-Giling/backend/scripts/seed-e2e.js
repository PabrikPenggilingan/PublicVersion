/**
 * seed-e2e.js
 * ─────────────────────────────────────────────────────────────────────
 * Seed script khusus untuk E2E Testing & Agentic Testing (Playwright).
 *
 * Script ini membuat dataset lengkap yang merepresentasikan siklus bisnis
 * penuh pabrik penggilingan gabah, dari pembelian hingga penjualan dan keuangan.
 *
 * AMAN DIJALANKAN: Script ini idempotent (bisa dijalankan berulang kali
 * tanpa membuat duplikat). Semua data bertag 'E2E Test' untuk mudah dibersihkan.
 *
 * CARA PAKAI:
 *   node scripts/seed-e2e.js           → seed data
 *   node scripts/seed-e2e.js --clean   → bersihkan semua data E2E test
 */

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// Try multiple .env locations
const envLocations = [
    path.join(__dirname, '../../.env'),
    path.join(__dirname, '../.env'),
    path.join(process.cwd(), '.env'),
];
for (const envPath of envLocations) {
    const result = require('dotenv').config({ path: envPath });
    if (!result.error) break;
}

if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set!');
    process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── CLEAN MODE ──────────────────────────────────────────────────────
async function clean(client) {
    console.log('🧹 Membersihkan data E2E Test...');

    // Hapus dalam urutan yang aman (FK-safe)
    await client.query(`DELETE FROM trx.finance_transactions WHERE description LIKE '%[E2E]%'`);
    await client.query(`DELETE FROM trx.overhead_expenses WHERE description LIKE '%[E2E]%'`);
    await client.query(`DELETE FROM trx.sale_payments WHERE notes = '[E2E Test]'`);
    await client.query(`DELETE FROM trx.sale_items si USING trx.sales s WHERE si.sale_id = s.id AND s.notes = '[E2E Test]'`);
    await client.query(`DELETE FROM trx.sales WHERE notes = '[E2E Test]'`);
    await client.query(`DELETE FROM trx.purchase_payments pp USING trx.purchases p WHERE pp.purchase_id = p.id AND p.nama LIKE '%[E2E]%'`);
    await client.query(`DELETE FROM trx.pendataan_gabah pg USING trx.purchases p WHERE pg.purchase_id = p.id AND p.nama LIKE '%[E2E]%'`);
    await client.query(`DELETE FROM trx.purchases WHERE nama LIKE '%[E2E]%'`);
    await client.query(`DELETE FROM trx.batches WHERE id IN (SELECT batch_id FROM trx.purchases WHERE nama LIKE '%[E2E]%')`);
    await client.query(`DELETE FROM trx.inventory_items WHERE notes LIKE '%[E2E]%'`);
    await client.query(`DELETE FROM trx.finance_accounts WHERE name LIKE '%[E2E]%'`);
    await client.query(`DELETE FROM trx.customers WHERE notes = '[E2E Test]'`);
    await client.query(`DELETE FROM sys.users WHERE username LIKE 'e2e_%'`);

    console.log('✅ Data E2E Test berhasil dibersihkan.\n');
}

// ── SEED ────────────────────────────────────────────────────────────
async function seed() {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        console.log('\n🌱 Memulai E2E Seed...\n');

        // ── 1. USERS ─────────────────────────────────────────────────
        console.log('👤 Membuat Users...');
        const adminHash = await bcrypt.hash('admin123', 10);
        const financeHash = await bcrypt.hash('finance123', 10);

        // Admin user (idempotent)
        let adminRes = await client.query(
            `SELECT id FROM sys.users WHERE username = 'admin'`
        );
        let adminId;
        if (adminRes.rows.length === 0) {
            const r = await client.query(
                `INSERT INTO sys.users (username, password_hash, role) VALUES ('admin', $1, 'admin') RETURNING id`,
                [adminHash]
            );
            adminId = r.rows[0].id;
            console.log(`  ✓ User 'admin' dibuat (ID: ${adminId})`);
        } else {
            adminId = adminRes.rows[0].id;
            console.log(`  ✓ User 'admin' sudah ada (ID: ${adminId})`);
        }

        // E2E Finance Manager user
        let finRes = await client.query(
            `SELECT id FROM sys.users WHERE username = 'e2e_finance'`
        );
        let financeId;
        if (finRes.rows.length === 0) {
            const r = await client.query(
                `INSERT INTO sys.users (username, password_hash, role) VALUES ('e2e_finance', $1, 'admin') RETURNING id`,
                [financeHash]
            );
            financeId = r.rows[0].id;
            console.log(`  ✓ User 'e2e_finance' dibuat`);
        } else {
            financeId = finRes.rows[0].id;
            console.log(`  ✓ User 'e2e_finance' sudah ada`);
        }

        // ── 2. FINANCE ACCOUNTS ──────────────────────────────────────
        console.log('\n💳 Membuat Finance Accounts...');
        const accounts = [
            { name: 'Kas Pabrik (Tunai) [E2E]',   type: 'CASH',    balance: 50000000 },
            { name: 'Rekening BCA [E2E]',          type: 'BANK',    balance: 150000000 },
            { name: 'Rekening Mandiri [E2E]',       type: 'BANK',    balance: 75000000 },
        ];

        const accountIds = {};
        for (const acc of accounts) {
            const existing = await client.query(
                `SELECT id FROM trx.finance_accounts WHERE name = $1`, [acc.name]
            );
            if (existing.rows.length === 0) {
                const r = await client.query(
                    `INSERT INTO trx.finance_accounts (name, account_type, balance)
                     VALUES ($1, $2, $3) RETURNING id`,
                    [acc.name, acc.type, acc.balance]
                );
                accountIds[acc.name] = r.rows[0].id;
                console.log(`  ✓ Akun '${acc.name}' dibuat (Saldo: Rp ${acc.balance.toLocaleString('id-ID')})`);
            } else {
                accountIds[acc.name] = existing.rows[0].id;
                console.log(`  ✓ Akun '${acc.name}' sudah ada`);
            }
        }

        const kasId  = accountIds['Kas Pabrik (Tunai) [E2E]'];
        const bcaId  = accountIds['Rekening BCA [E2E]'];

        // ── 3. CUSTOMERS ─────────────────────────────────────────────
        console.log('\n🧑‍🤝‍🧑 Membuat Customers...');

        // Get default tier
        let tierRes = await client.query(`SELECT id FROM mst.customer_tiers LIMIT 1`);
        let tierId = tierRes.rows[0]?.id;
        if (!tierId) {
            const tr = await client.query(
                `INSERT INTO mst.customer_tiers (name, description) VALUES ('Reguler', 'Pelanggan Reguler') RETURNING id`
            );
            tierId = tr.rows[0].id;
        }

        const customers = [
            { name: 'Toko Beras Pak Santoso', phone: '081234567890', address: 'Jl. Pasar Lama No.5' },
            { name: 'UD Makmur Sejahtera',    phone: '082345678901', address: 'Jl. Sudirman No.12' },
        ];
        const customerIds = [];
        for (const c of customers) {
            const ex = await client.query(
                `SELECT id FROM trx.customers WHERE name = $1 AND notes = '[E2E Test]'`, [c.name]
            );
            if (ex.rows.length === 0) {
                const r = await client.query(
                    `INSERT INTO trx.customers (name, phone, address, tier_id, notes)
                     VALUES ($1, $2, $3, $4, '[E2E Test]') RETURNING id`,
                    [c.name, c.phone, c.address, tierId]
                );
                customerIds.push(r.rows[0].id);
                console.log(`  ✓ Customer '${c.name}' dibuat`);
            } else {
                customerIds.push(ex.rows[0].id);
                console.log(`  ✓ Customer '${c.name}' sudah ada`);
            }
        }

        // ── 4. BATCH + PURCHASES ─────────────────────────────────────
        console.log('\n📦 Membuat Batch & Pembelian Gabah...');

        const batchEx = await client.query(
            `SELECT id FROM trx.batches WHERE id IN (SELECT batch_id FROM trx.purchases WHERE nama LIKE '%[E2E]%') LIMIT 1`
        );
        let batchId;
        if (batchEx.rows.length === 0) {
            const bRes = await client.query(
                `INSERT INTO trx.batches (created_by, batch_date, status)
                 VALUES ($1, CURRENT_DATE - INTERVAL '3 days', 'CLOSED') RETURNING id`,
                [adminId]
            );
            batchId = bRes.rows[0].id;
            console.log(`  ✓ Batch dibuat (ID: ${batchId})`);
        } else {
            batchId = batchEx.rows[0].id;
            console.log(`  ✓ Batch sudah ada`);
        }

        const gabahPurchases = [
            { nama: 'Pak Budi [E2E]',  calo: 'Ibu Siti',  harga: 7500, berat: 2000, kualitas: 'bagus',      kondisi: 'kering', kadar_air: 14.5 },
            { nama: 'Pak Ahmad [E2E]', calo: 'Pak Hasan', harga: 7200, berat: 1500, kualitas: 'biasa',       kondisi: 'basah',  kadar_air: 16.0 },
            { nama: 'Ibu Rani [E2E]',  calo: 'Ibu Siti',  harga: 7800, berat: 1000, kualitas: 'sangat_bagus', kondisi: 'kering', kadar_air: 13.0 },
        ];

        const purchaseIds = [];
        for (const p of gabahPurchases) {
            const ex = await client.query(
                `SELECT id FROM trx.purchases WHERE nama = $1 AND batch_id = $2`, [p.nama, batchId]
            );
            if (ex.rows.length === 0) {
                const pr = await client.query(
                    `INSERT INTO trx.purchases
                     (batch_id, nama, calo, harga_per_kg, lokasi_belanja, berat_gabah_kg, kualitas_gabah, filled_by)
                     VALUES ($1,$2,$3,$4,'Sawah E2E',$5,$6,$7) RETURNING id`,
                    [batchId, p.nama, p.calo, p.harga, p.berat, p.kualitas, adminId]
                );
                const pId = pr.rows[0].id;
                purchaseIds.push(pId);

                await client.query(
                    `INSERT INTO trx.pendataan_gabah (purchase_id, jenis_gabah, kondisi_gabah, kadar_air, kadar_hampa, created_by)
                     VALUES ($1,'IR64',$2,$3,2.5,$4)`,
                    [pId, p.kondisi, p.kadar_air, adminId]
                );
                console.log(`  ✓ Pembelian dari '${p.nama}' (${p.berat} kg @ Rp ${p.harga})`);
            } else {
                purchaseIds.push(ex.rows[0].id);
                console.log(`  ✓ Pembelian '${p.nama}' sudah ada`);
            }
        }

        // ── 5. INVENTORY (Beras hasil giling) ────────────────────────
        console.log('\n📊 Membuat Inventory Beras...');

        // Get category BERAS
        const catRes = await client.query(
            `SELECT code FROM mst.item_categories WHERE code = 'BERAS' LIMIT 1`
        );
        const berasCatCode = catRes.rows[0]?.code || 'BERAS';

        const invEx = await client.query(
            `SELECT id FROM trx.inventory_items WHERE notes = 'Stok Beras E2E [E2E]' LIMIT 1`
        );
        if (invEx.rows.length === 0) {
            await client.query(
                `INSERT INTO trx.inventory_items
                 (source_type, product_category_code, total_weight_kg, remaining_weight_kg, avg_price_per_kg, status, notes, created_by)
                 VALUES ('process', $1, 2800, 2800, 9500, 'AVAILABLE', 'Stok Beras E2E [E2E]', $2) RETURNING id`,
                [berasCatCode, adminId]
            );
            console.log(`  ✓ Inventory Beras 2.800 kg dibuat (HPP: Rp 9.500/kg)`);
        } else {
            console.log(`  ✓ Inventory Beras sudah ada`);
        }

        // Create Gabah Inventory for milling process
        const gabahCatCode = 'GABAH';
        const invGabahEx = await client.query(
            `SELECT id FROM trx.inventory_items WHERE notes = 'Stok Gabah E2E [E2E]' LIMIT 1`
        );
        if (invGabahEx.rows.length === 0) {
            await client.query(
                `INSERT INTO trx.inventory_items
                 (source_type, product_category_code, total_weight_kg, remaining_weight_kg, avg_price_per_kg, status, notes, area, created_by)
                 VALUES ('batch', $1, 4500, 4500, 7500, 'AVAILABLE', 'Stok Gabah E2E [E2E]', 'Gudang Depan', $2) RETURNING id`,
                [gabahCatCode, adminId]
            );
            console.log(`  ✓ Inventory Gabah 4.500 kg dibuat (HPP: Rp 7.500/kg)`);
        } else {
            console.log(`  ✓ Inventory Gabah sudah ada`);
        }

        // ── 6. FINANCE TRANSACTIONS (Sample APPROVED & PENDING) ──────
        console.log('\n💰 Membuat Finance Transactions...');

        const today = new Date().toISOString().split('T')[0];

        // 2 APPROVED transactions (visible in Ledger PDF)
        const approvedTxs = [
            {
                accountId: bcaId, type: 'IN', amount: 15000000, cat: 'SALES',
                desc: 'Pembayaran Nota Penjualan Toko Santoso [E2E]', status: 'APPROVED'
            },
            {
                accountId: kasId, type: 'OUT', amount: 2500000, cat: 'OVERHEAD',
                desc: 'Biaya Operasional Harian [E2E]', status: 'APPROVED'
            },
        ];
        for (const tx of approvedTxs) {
            await client.query(
                `INSERT INTO trx.finance_transactions
                 (account_id, transaction_type, amount, category, description, created_by, status)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [tx.accountId, tx.type, tx.amount, tx.cat, tx.desc, adminId, tx.status]
            );
            console.log(`  ✓ TX APPROVED: ${tx.desc} (${tx.type} Rp ${tx.amount.toLocaleString('id-ID')})`);
        }

        // 3 PENDING transactions (visible in Approval Center)
        const pendingTxs = [
            {
                type: 'IN',  amount: 8500000,  cat: 'SALES',
                desc: 'Pembayaran Nota Sales UD Makmur [E2E]', module: 'SALES'
            },
            {
                type: 'OUT', amount: 1200000,  cat: 'LOGISTICS',
                desc: 'Biaya Kuli Angkut Bongkar 2 Truk [E2E]', module: 'LOGISTICS'
            },
            {
                type: 'OUT', amount: 750000,   cat: 'DRYING_COST',
                desc: 'Biaya Kuli Jemur Gabah 3 Hari [E2E]', module: 'DRYING'
            },
        ];
        for (const tx of pendingTxs) {
            await client.query(
                `INSERT INTO trx.finance_transactions
                 (account_id, transaction_type, amount, category, description, created_by, status, source_module)
                 VALUES (NULL,$1,$2,$3,$4,$5,'PENDING',$6)`,
                [tx.type, tx.amount, tx.cat, tx.desc, adminId, tx.module]
            );
            console.log(`  ⏳ TX PENDING: ${tx.desc} (${tx.type} Rp ${tx.amount.toLocaleString('id-ID')})`);
        }

        // ── 7. OVERHEAD EXPENSE ───────────────────────────────────────
        console.log('\n📋 Membuat Overhead Expense...');
        await client.query(
            `INSERT INTO trx.overhead_expenses
             (expense_date, category, description, amount, frequency, payment_method, finance_account_id, created_by)
             VALUES (CURRENT_DATE, 'UTILITIES', 'Token Listrik Pabrik [E2E]', 500000, 'MONTHLY', 'CASH', $1, $2)`,
            [kasId, adminId]
        );
        console.log(`  ✓ Overhead: Token Listrik Rp 500.000`);

        await client.query('COMMIT');

        // ── SUMMARY ──────────────────────────────────────────────────
        console.log('\n╔══════════════════════════════════════════════════╗');
        console.log('║         E2E Seed Selesai! ✅                    ║');
        console.log('╚══════════════════════════════════════════════════╝');
        console.log('\n📋 CREDENTIALS:');
        console.log('  Admin    → username: admin        | password: admin123');
        console.log('  Finance  → username: e2e_finance  | password: finance123');
        console.log('\n💾 DATA YANG DIBUAT:');
        console.log('  ✓ 3 Finance Accounts (Kas Pabrik, BCA, Mandiri)');
        console.log('  ✓ 2 Customers (Toko Santoso, UD Makmur)');
        console.log('  ✓ 1 Batch + 3 Purchases (gabah dari petani)');
        console.log('  ✓ Inventory Beras 2.800 kg siap jual');
        console.log('  ✓ 2 Finance Transactions APPROVED (di Ledger PDF)');
        console.log('  ✓ 3 Finance Transactions PENDING (di Approval Center)');
        console.log('  ✓ 1 Overhead Expense');
        console.log('\n🧹 UNTUK CLEAN:');
        console.log('  node scripts/seed-e2e.js --clean');
        console.log('');

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n❌ Seed gagal:', err.message);
        console.error(err.stack);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// ── ENTRY POINT ──────────────────────────────────────────────────────
async function main() {
    const isClean = process.argv.includes('--clean');

    if (isClean) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await clean(client);
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('❌ Clean gagal:', err.message);
        } finally {
            client.release();
            await pool.end();
        }
    } else {
        await seed();
    }
}

main();
