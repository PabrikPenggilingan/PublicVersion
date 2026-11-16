const { pool, logPool } = require('../src/config/database');

// Hook yang dijalankan setelah SEMUA tes selesai
afterAll(async () => {
  // Menutup koneksi database agar Jest bisa keluar (exit) dengan bersih
  await pool.end();
  await logPool.end();
});
