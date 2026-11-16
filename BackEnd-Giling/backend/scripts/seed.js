const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function seed() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Starting seed process...\n');

    // 1. Create default admin user
    console.log('Creating default admin user...');
    const passwordHash = await bcrypt.hash('admin123', 10);
    
    const existingAdmin = await client.query(
      `SELECT id FROM sys.users WHERE username = 'admin'`
    );

    let adminUserId;
    if (existingAdmin.rows.length === 0) {
      const userResult = await client.query(
        `INSERT INTO sys.users (username, password_hash, role)
         VALUES ('admin', $1, 'admin')
         RETURNING id`,
        [passwordHash]
      );
      adminUserId = userResult.rows[0].id;
      console.log(`✓ Admin user created with ID: ${adminUserId}`);
    } else {
      adminUserId = existingAdmin.rows[0].id;
      console.log(`✓ Admin user already exists with ID: ${adminUserId}`);
    }

    // 2. Create sample batch
    console.log('\nCreating sample batch...');
    const batchResult = await client.query(
      `INSERT INTO trx.batches (created_by, batch_date, status)
       VALUES ($1, CURRENT_DATE, 'OPEN')
       RETURNING id`,
      [adminUserId]
    );
    const batchId = batchResult.rows[0].id;
    console.log(`✓ Sample batch created with ID: ${batchId}`);

    // 3. Create sample purchases
    console.log('\nCreating sample purchases...');
    const purchases = [
      {
        nama: 'Pak Budi',
        calo: 'Ibu Siti',
        harga_per_kg: 7500,
        lokasi_belanja: 'Sawah Indah, Desa Makmur',
        berat_gabah_kg: 1500,
        jenis_gabah: 'IR64',
        kadar_air: 14.5,
        kadar_hampa: 2.3,
        kualitas_gabah: 'bagus',
        kondisi_gabah: 'kering'
      },
      {
        nama: 'Pak Ahmad',
        calo: 'Pak Hasan',
        harga_per_kg: 7200,
        lokasi_belanja: 'Sawah Sentosa, Desa Sejahtera',
        berat_gabah_kg: 1200,
        jenis_gabah: 'Ciherang',
        kadar_air: 15.0,
        kadar_hampa: 3.0,
        kualitas_gabah: 'biasa',
        kondisi_gabah: 'basah'
      },
      {
        nama: 'Ibu Ani',
        calo: 'Ibu Siti',
        harga_per_kg: 7800,
        lokasi_belanja: 'Sawah Premium, Desa Maju',
        berat_gabah_kg: 800,
        jenis_gabah: 'IR64',
        kadar_air: 13.5,
        kadar_hampa: 1.5,
        kualitas_gabah: 'sangat_bagus',
        kondisi_gabah: 'kering'
      }
    ];

    for (const p of purchases) {
      // Insert base purchase data
      const pResult = await client.query(
        `INSERT INTO trx.purchases 
         (batch_id, nama, calo, harga_per_kg, lokasi_belanja, berat_gabah_kg, kualitas_gabah, filled_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          batchId,
          p.nama,
          p.calo,
          p.harga_per_kg,
          p.lokasi_belanja,
          p.berat_gabah_kg,
          p.kualitas_gabah,
          adminUserId
        ]
      );
      
      const purchaseId = pResult.rows[0].id;

      // Insert R&D / Pendataan data (fields moved from purchases in migration 031)
      await client.query(
        `INSERT INTO trx.pendataan_gabah 
         (purchase_id, jenis_gabah, kondisi_gabah, kadar_air, kadar_hampa, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          purchaseId,
          p.jenis_gabah,
          p.kondisi_gabah,
          p.kadar_air,
          p.kadar_hampa,
          adminUserId
        ]
      );

      console.log(`✓ Purchase from ${p.nama} created (+ R&D data)`);
    }

    await client.query('COMMIT');

    console.log('\n═══════════════════════════════════════');
    console.log('Seed completed successfully! ✓');
    console.log('═══════════════════════════════════════');
    console.log('\nDefault credentials:');
    console.log('  Username: admin');
    console.log('  Password: admin123');
    console.log('═══════════════════════════════════════\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
