-- Diagnosa produksi (READ-ONLY): isolasi data & data yang hilang setelah deploy 15 Nov 2026
-- Jalankan di Supabase → SQL Editor, satu blok per kali. Tidak ada perintah yang mengubah data.

-- 1) User yang terhubung ke owner lain (dibuat lewat Master Akses setelah deploy)
SELECT u.username, u.role, u.created_at, o.username AS owner_username
FROM sys.users u
LEFT JOIN sys.users o ON o.id = u.owner_id
WHERE u.owner_id IS NOT NULL
ORDER BY u.created_at;

-- 2) Riwayat migration: apakah migration lama (001–094) ikut jalan ulang saat deploy?
--    Normalnya hanya 095–100 yang tanggalnya baru.
SELECT DATE(executed_at) AS tanggal, COUNT(*) AS jumlah, MIN(filename) AS pertama, MAX(filename) AS terakhir
FROM public.migrations_history
GROUP BY DATE(executed_at)
ORDER BY tanggal;

-- 3) Jumlah data per user per tabel utama (bandingkan dengan yang seharusnya ada)
SELECT u.username,
       (SELECT COUNT(*) FROM trx.batches b         WHERE b.created_by = u.id) AS batch,
       (SELECT COUNT(*) FROM trx.purchases p       WHERE p.filled_by  = u.id) AS pembelian,
       (SELECT COUNT(*) FROM trx.sales s           WHERE s.created_by = u.id) AS nota,
       (SELECT COUNT(*) FROM trx.inventory_items i WHERE i.created_by = u.id) AS stok,
       (SELECT COUNT(*) FROM trx.processes pr      WHERE pr.created_by = u.id) AS giling,
       (SELECT COUNT(*) FROM trx.drying_processes d WHERE d.created_by = u.id) AS jemur,
       (SELECT COUNT(*) FROM trx.journal_entries j WHERE j.created_by = u.id) AS jurnal
FROM sys.users u
ORDER BY u.created_at;

-- 4) Data tanpa pemilik (tidak terlihat oleh siapa pun kecuali super admin)
SELECT 'batches' AS tabel, COUNT(*) FROM trx.batches WHERE created_by IS NULL
UNION ALL SELECT 'sales', COUNT(*) FROM trx.sales WHERE created_by IS NULL
UNION ALL SELECT 'inventory_items', COUNT(*) FROM trx.inventory_items WHERE created_by IS NULL
UNION ALL SELECT 'processes', COUNT(*) FROM trx.processes WHERE created_by IS NULL
UNION ALL SELECT 'journal_entries', COUNT(*) FROM trx.journal_entries WHERE created_by IS NULL;

-- 5) Total baris & data terbaru per tabel (apakah data lama benar-benar hilang dari database)
SELECT 'batches' AS tabel, COUNT(*) AS total, MIN(created_at) AS paling_lama, MAX(created_at) AS paling_baru FROM trx.batches
UNION ALL SELECT 'purchases', COUNT(*), MIN(created_at), MAX(created_at) FROM trx.purchases
UNION ALL SELECT 'sales', COUNT(*), MIN(created_at), MAX(created_at) FROM trx.sales
UNION ALL SELECT 'inventory_items', COUNT(*), MIN(created_at), MAX(created_at) FROM trx.inventory_items
UNION ALL SELECT 'journal_entries', COUNT(*), MIN(created_at), MAX(created_at) FROM trx.journal_entries
UNION ALL SELECT 'users', COUNT(*), MIN(created_at), MAX(created_at) FROM sys.users;
