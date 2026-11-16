# Dokumentasi Teknis: Arsitektur Backend & Database Finance Center

Dokumen ini adalah panduan bedah teknis (*under the hood*) yang menjabarkan perubahan arsitektur *codebase* backend, khusus untuk developer yang ingin memahami cara kerja *Double-Entry Integration* dan *Atomic Concurrency Control*.

---

## 1. Bedah Integrasi ORM Akuntansi Berpasangan (Double-Entry)
Sebelum modifikasi ini, kita banyak menggunakan `financeModel.createTransaction()`. Kini, kita telah menyingkirkan *method* tersebut di *Services* utama dan menggantinya dengan `financeModel.createJournalEntry()`.

### Contoh Implementasi di `purchase.service.js`:
Saat ada transaksi pembelian gabah (Purchase), sistem tidak langsung menaruh angkanya di tabel kas. Alih-alih, ia menarik master data akun terlebih dahulu melalui ORM Database:
```javascript
const invRes = await db.query(`SELECT id FROM trx.finance_accounts WHERE account_code = '1-300' LIMIT 1`); // Persediaan
const apRes = await db.query(`SELECT id FROM trx.finance_accounts WHERE account_code = '2-100' LIMIT 1`); // Hutang Usaha

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
**Mengapa ini penting secara teknis?**
Pendekatan ini memisahkan secara tegas antara "Aksi Bisnis" (Beli Gabah) dengan "Dampak Finansial". Modul pembelian tidak peduli uangnya keluar dari mana (Kas Tunai, Transfer BCA, dll), dia hanya mencatatkan dua lengan (*lines*): menambah nilai Aset Persediaan di Gudang (Debit), dan menambah beban Hutang kita ke Petani (Kredit). 
Pemetaan sumber dana baru diputuskan nanti oleh tim Keuangan saat melakukan persetujuan (Approval) lewat UI Dashboard.

---

## 2. Bedah Penguncian Tingkat Rendah (Row-Level Locking) & Atomic Upsert
Menghadapi error `500 Internal Server Error: Duplicate entry 'sale_no'`, kita mengimplementasikan pola arsitektur *Queue-by-Lock* pada PostgreSQL.

Kunci utamanya terletak di file *migration* baru `080_fix_sale_no_race_condition.sql`. Kita melepaskan ketergantungan dari membaca isi tabel raksasa `sales` dan memindahkannya ke tabel mikro baru: `trx.transaction_sequences`.

### Anatomi Sintaks Upsert di PostgreSQL:
```sql
INSERT INTO trx.transaction_sequences (prefix, last_seq)
VALUES (v_prefix, v_max_seq + 1)
ON CONFLICT (prefix) DO UPDATE
SET last_seq = trx.transaction_sequences.last_seq + 1
RETURNING last_seq INTO v_seq;
```
**Cara Kerja Mesin Database (Concurrency Flow):**
1. **Eval Prefix:** *Trigger* mendeteksi transaksi masuk pada bulan Agustus, ia membentuk *key* `JUAL/2026/08`.
2. **Atomic Execution:** Baris query di atas adalah satu entitas instruksi tunggal. Jika ada dua Request (A dan B) mengeksekusi instruksi ini persis secara bersamaan.
3. **Pilar ON CONFLICT:** Request A berhasil mengeksekusi *INSERT* (jika *prefix* belum pernah ada sebelumnya). Di milidetik yang sama, Request B menemui jalan buntu karena *Primary Key* `JUAL/2026/08` tiba-tiba eksis.
4. **Pilar DO UPDATE:** Postgres secara cerdas melemparkan Request B ke blok `DO UPDATE`. Sifat klausa `UPDATE` di Postgres secara implisit menerapkan `FOR UPDATE` (mengunci baris data).
5. **Waiting Queue:** Karena Request A masih aktif, Request B disuruh menunggu (Sleep) oleh *thread* mesin database. Tidak ada error bentrok (collision) yang dilemparkan ke aplikasi Node.js!
6. **Resolusi:** Begitu Request A selesai menarik angka (misal: 10), gembok baris dilepas. Request B terbangun, membaca *state* yang paling segar (10), menambahkannya menjadi 11, dan mengambilnya (`RETURNING last_seq`).

Teknik ini (*Atomic Upsert Sequence*) adalah standar industri (*best practice*) dalam sistem perbankan untuk menjamin nol tabrakan tanpa mengorbankan performa *Query* secara keseluruhan!
