const { Pool } = require('pg');
const DATABASE_URL = 'postgresql://postgres:12345678@localhost:5432/gabah_db';

const pool = new Pool({
  connectionString: DATABASE_URL
});

async function seedSalesV2() {
  console.log('Seeding Sales V2 Data...');
  try {
    // 1. Get Admin User ID
    const userRes = await pool.query("SELECT id FROM sys.users WHERE role = 'admin' LIMIT 1");
    if (userRes.rows.length === 0) {
      console.error('No admin user found. Please run main seed first.');
      return;
    }
    const adminId = userRes.rows[0].id;

    // 2. Get Tiers (already seeded by migration 044, but let's make sure)
    const tierRes = await pool.query("SELECT id, name FROM mst.customer_tiers ORDER BY sort_order");
    const tiers = tierRes.rows;
    console.log(`Found ${tiers.length} tiers`);

    // 3. Create Sample Customers
    const customers = [
      { name: 'Agen Beras Barokah', phone: '08123456789', tier: 'Ring 1', address: 'Pasar Induk Cipinang Blok A' },
      { name: 'Toko Kelontong Makmur', phone: '08567891234', tier: 'Ring 2', address: 'Jl. Raya Desa No. 10' },
      { name: 'Ibu Hajah Siti', phone: '08991234567', tier: 'Ring 3', address: 'Perumahan Gading No. 5' },
    ];

    for (const c of customers) {
      const tierId = tiers.find(t => t.name === c.tier)?.id;
      await pool.query(
        `INSERT INTO trx.customers (name, phone, address, tier_id, created_by) 
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
        [c.name, c.phone, c.address, tierId, adminId]
      );
      console.log(`✓ Customer ${c.name} seeded`);
    }

    // 4. Create Sample Price List (for Beras and Gabah)
    const categories = await pool.query("SELECT id, code FROM mst.item_categories");
    const berasId = categories.rows.find(c => c.code === 'BERAS')?.id;
    const gabahId = categories.rows.find(c => c.code === 'GABAH')?.id;

    if (berasId && tiers.length > 0) {
      const prices = [
        { tier: 'Ring 1', categoryId: berasId, priceKg: 13500, priceSack: 675000 },
        { tier: 'Ring 2', categoryId: berasId, priceKg: 14000, priceSack: 700000 },
        { tier: 'Ring 3', categoryId: berasId, priceKg: 14500, priceSack: 725000 },
      ];

      for (const p of prices) {
        const tierId = tiers.find(t => t.name === p.tier)?.id;
        await pool.query(
          `INSERT INTO mst.price_list (tier_id, category_id, price_per_kg, price_per_sack, effective_date, created_by)
           VALUES ($1, $2, $3, $4, CURRENT_DATE, $5) ON CONFLICT DO NOTHING`,
          [tierId, p.categoryId, p.priceKg, p.priceSack, adminId]
        );
      }
      console.log('✓ Price list seeded');
    }

    console.log('✨ Sales V2 Seeding Completed!');
  } catch (err) {
    console.error('Seeding failed:', err.message);
  } finally {
    await pool.end();
  }
}

seedSalesV2();
