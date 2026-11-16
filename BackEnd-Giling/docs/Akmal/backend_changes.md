# Catatan Perubahan Spesifik (Backend Layer)

Halo Akmal! Berikut adalah pemetaan jejak *commit* / draf lokal aktual yang telah disuntikkan ke lingkungan sistem *Backend Node.js* kita. Seluruh kode ini didedikasikan untuk membawa fungsionalitas akuntansi `Double-Entry` di level infrastruktur.

---

## 1. Upgrade Arsitektur Auto-Numbering Nota
**Lokasi File:** `backend/migrations/080_fix_sale_no_race_condition.sql` (Baru Ditambahkan)

**Detail Perubahan:**
Menciptakan file migrasi database #080 untuk menanamkan pondasi antrean transaksi yang imun terhadap gangguan bentrokan jaringan (*High Concurrency*).
- Membuat tabel khusus memori urutan: `trx.transaction_sequences`.
- Memperbarui fungsi *Database Trigger* `generate_sale_no()`. Fungsi lamanya dicabut, diganti dengan klausa `INSERT ... ON CONFLICT (prefix) DO UPDATE SET last_seq = ... RETURNING last_seq`.
- Kode ini memaksa PostgreSQL untuk memegang *Lock* baris `FOR UPDATE` (mengantrekan semua permintaan API dari aplikasi Node.js secara otomatis tanpa *bottleneck* sistem).

---

## 2. Injeksi Double-Entry pada Modul Operasional (Service Level)
**Lokasi Keseluruhan File:**
- `backend/src/services/purchase.service.js`
- `backend/src/services/process.service.js`
- `backend/src/services/salesV2.service.js`

**Detail Perubahan:**
Kita menghapus dan mengganti fungsi tunggal usang `createTransaction` dengan fungsi ganda baru bernama `createJournalEntry`. Hal ini diwajibkan demi menciptakan pasangan *Debit* dan *Kredit* yang proporsional dan transparan di dalam *General Ledger* buku besar pabrik.

**Struktur Kode yang Disuntikkan:**
Misalnya pada file `purchase.service.js`, sesaat sebelum mengembalikan `return purchase;`, sistem secara senyap merangkai kueri pencarian ID akun (seperti `1-300` untuk *Persediaan* dan `2-100` untuk *Hutang AP*), dan mengirimnya sebagai parameter garis (*lines*) ke *model*:

```javascript
const invRes = await db.query(`SELECT id FROM trx.finance_accounts WHERE account_code = '1-300' LIMIT 1`);
const apRes = await db.query(`SELECT id FROM trx.finance_accounts WHERE account_code = '2-100' LIMIT 1`);

await financeModel.createJournalEntry({
    referenceType: 'PURCHASE',
    referenceId: purchase.id,
    description: `Pembelian Gabah: ${data.nama}`,
    status: 'PENDING',
    lines: [
        { accountId: invRes.rows[0].id, debit: Number(data.totalHarga), credit: 0 },
        { accountId: apRes.rows[0].id, debit: 0, credit: Number(data.totalHarga) }
    ]
});
```
*Note: Status mutlak diset ke **PENDING** (*`accountId` Kas dapat bernilai `null` terlebih dahulu*).*

---

## 3. Kalkulasi P&L PDF Laporan Harian yang Berintegritas
**Lokasi File:** `backend/src/services/pdf.service.js`

**Detail Perubahan:**
Berdasarkan keluhan logika pencampuran modal belanja mentah dan laba operasional, perenderan tabel laporan PDF dimodifikasi:
1. Label *Laba Bersih* direvisi namanya menjadi `"LABA OPERASIONAL (Operating Profit)"`.
2. Menyisipkan deret grup tabel baru bernama `"Modal Usaha (Belanja Gabah)"` yang secara visual akan muncul sebagai pengurang langsung setelah *Operating Profit*.
3. Kalkulasi di baris paling ujung kini menyandang nama `"LABA BERSIH RIIL (Net Real Profit)"` dengan perhitungan mandiri di mana nilainya adalah murni:
```javascript
// Penggalan Kode PDF Generator
{ text: fmt((summary.operatingProfit || 0) - (summary.procurement || 0)) }
```
Kini direktur dapat melihat profit *pure margin* (EBITDA) dari proses giling dan penjualan hari itu dengan sangat kentara, sebelum dipotong pengeluaran masif untuk memborong gabah kering (Inventory).
