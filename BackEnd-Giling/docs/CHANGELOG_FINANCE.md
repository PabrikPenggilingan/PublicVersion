# Changelog Perbaikan Keuangan & Otentikasi (Agustus 2026)

Dokumen ini mendokumentasikan rincian perubahan kode, file-file yang dimodifikasi, fungsi-fungsi yang diperbaiki, serta tindakan sinkronisasi database untuk mengatasi masalah otentikasi, orphaning data ledger, layout PDF, dan error 500.

---

## Ringkasan Perubahan

1.  **Otentikasi Middleware**: Penyesuaian nama tabel menjadi `sys.users` pada fungsi `optionalAuth`.
2.  **Integritas Ledger Transaksi**: Penghapusan biaya giling, biaya jemur, dan pembayaran penjualan sekarang melacak transaksi ledger pendukung secara cascade dan mengembalikan saldo kas jika sudah disetujui (*APPROVED*).
3.  **Penyelarasan PDF**: Pemetaan variabel laba kotor, laba operasional, dan margin operasional agar nilai pada cetakan laporan PDF tidak bernilai nol (`Rp0`).
4.  **Resolusi Error 500 (Skema Database)**: Eksekusi manual migrasi yang terlewat (`042`, `056`, `057`), pengaktifan migrasi penambahan status transaksi keuangan (`062`-`069`), serta perbaikan pemanggilan kolom `created_at` di query HPP inventaris.

---

## Rincian Perubahan File & Fungsi

### 1. [auth.js](file:///c:/GAWEH/COLLECT%20DATA%20GABAH/src/BackEnd-Giling/backend/src/middleware/auth.js#L75)
*   **Fungsi**: `optionalAuth`
*   **Masalah**: Query mencari data pengguna ke tabel `users` (yang sudah deprecated), menyebabkan error saat token JWT opsional divalidasi.
*   **Perubahan**: Diubah ke tabel `sys.users` dan ditambahkan kolom `privilege_level` agar kompatibel dengan middleware utama.
*   **Cuplikan Kode**:
    ```javascript
    const result = await query(
      'SELECT id, username, role, privilege_level FROM sys.users WHERE id = $1',
      [decoded.userId]
    );
    ```

### 2. [process.service.js](file:///c:/GAWEH/COLLECT%20DATA%20GABAH/src/BackEnd-Giling/backend/src/services/process.service.js#L443)
*   **Fungsi**: `deleteProcessCost`
*   **Masalah**: Biaya ekstra giling yang dihapus menyisakan transaksi kas gantung (*orphaned*) di tabel ledger.
*   **Perubahan**: Menambahkan fungsi pencarian transaksi kas pendukung. Jika transaksi berstatus `'APPROVED'`, jumlah uang dikembalikan ke saldo kas pembayar, kemudian transaksi ledger tersebut dihapus secara permanen sebelum HPP beras dihitung ulang.
*   **Cuplikan Kode**:
    ```javascript
    if (deleted.finance_transaction_id) {
        const db = require('../config/database');
        const txResult = await db.query(
            "SELECT account_id, amount, status FROM trx.finance_transactions WHERE id = $1",
            [deleted.finance_transaction_id]
        );
        if (txResult.rows.length > 0) {
            const tx = txResult.rows[0];
            if (tx.status === 'APPROVED' && tx.account_id) {
                await db.query(
                    "UPDATE trx.finance_accounts SET balance = balance + $1 WHERE id = $2",
                    [tx.amount, tx.account_id]
                );
            }
            await db.query("DELETE FROM trx.finance_transactions WHERE id = $1", [deleted.finance_transaction_id]);
        }
    }
    ```

### 3. [drying.service.js](file:///c:/GAWEH/COLLECT%20DATA%20GABAH/src/BackEnd-Giling/backend/src/services/drying.service.js#L450)
*   **Fungsi**: `deleteDryingCost`
*   **Masalah**: Logika pengembalian saldo kas saat penghapusan biaya jemur tidak mengecek status persetujuan transaksi, memicu ketidakseimbangan jika transaksi masih *PENDING*.
*   **Perubahan**: Menambahkan klausa pengecekan `status === 'APPROVED'` sebelum saldo kas ditambah kembali.
*   **Cuplikan Kode**:
    ```javascript
    if (tx.status === 'APPROVED' && tx.account_id) {
        await db.query(
            "UPDATE trx.finance_accounts SET balance = balance + $1 WHERE id = $2",
            [tx.amount, tx.account_id]
        );
    }
    ```

### 4. [saleV2.model.js](file:///c:/GAWEH/COLLECT%20DATA%20GABAH/src/BackEnd-Giling/backend/src/models/saleV2.model.js#L98)
*   **Fungsi**: `salePaymentModel.create`
*   **Masalah**: Seluruh cicilan/penerimaan pembayaran penjualan didaftarkan ke ledger keuangan dengan `reference_id` berupa `saleId` (id nota penjualan induk), sehingga sulit dilacak pembayaran mana yang menghasilkan baris ledger kas yang mana.
*   **Perubahan**: Mengubah parameter `referenceId` dari `saleId` menjadi `payment.id` (id pembayaran penjualan unik).

### 5. [salesV2.service.js](file:///c:/GAWEH/COLLECT%20DATA%20GABAH/src/BackEnd-Giling/backend/src/services/salesV2.service.js#L271)
*   **Fungsi**: `PaymentService.delete`
*   **Masalah**: Penghapusan riwayat pembayaran penjualan menyisakan transaksi pendapatan di buku ledger kas.
*   **Perubahan**: Dibungkus dalam database transaction (`BEGIN ... COMMIT`). Layanan mencari baris ledger kas berdasarkan `reference_id = paymentId` dan `source_module = 'SALES'`. Jika sudah `APPROVED`, nilai pembayaran dipotong dari saldo akun kas, dan data pembayaran beserta transaksi ledger dihapus.
*   **Cuplikan Kode**:
    ```javascript
    // Di dalam BEGIN ... COMMIT:
    const txResult = await client.query(
        "SELECT account_id, amount, status FROM trx.finance_transactions WHERE reference_id = $1 AND source_module = 'SALES'",
        [paymentId]
    );
    if (txResult.rows.length > 0) {
        const tx = txResult.rows[0];
        if (tx.status === 'APPROVED' && tx.account_id) {
            await client.query(
                "UPDATE trx.finance_accounts SET balance = balance - $1 WHERE id = $2",
                [tx.amount, tx.account_id]
            );
        }
        await client.query(
            "DELETE FROM trx.finance_transactions WHERE reference_id = $1 AND source_module = 'SALES'",
            [paymentId]
        );
    }
    await client.query("DELETE FROM trx.sale_payments WHERE id = $1", [paymentId]);
    ```

### 6. [pdf.service.js](file:///c:/GAWEH/COLLECT%20DATA%20GABAH/src/BackEnd-Giling/backend/src/services/pdf.service.js#L169)
*   **Fungsi**: `generateFinancialReport`
*   **Masalah**: Nilai total laba bersih dan margin di PDF tercetak `Rp0` karena layout mengambil data `summary.netProfit` dan `summary.netMarginPct` yang tidak didefinisikan oleh modul keuangan.
*   **Perubahan**: Mengubah target pembacaan variabel ke `summary.operatingProfit` dan `summary.operatingMarginPct`.

### 7. [finance.service.js](file:///c:/GAWEH/COLLECT%20DATA%20GABAH/src/BackEnd-Giling/backend/src/services/finance.service.js#L295)
*   **Fungsi**: `getBalanceSheet`
*   **Masalah**: Perhitungan nilai aset inventaris harian crash dengan error `column t.transaction_date does not exist`.
*   **Perubahan**: Menyesuaikan nama kolom pembanding tanggal dari `t.transaction_date` ke kolom fisik asli di database, yaitu `t.created_at`.
*   **Cuplikan Kode**:
    ```sql
    LEFT JOIN trx.inventory_transactions t ON t.inventory_item_id = i.id AND DATE(t.created_at) <= $1
    ```

---

## Tindakan Eksekusi Database (SQL DDL)

Untuk menyelaraskan struktur database fisik dengan revisi kode di atas, langkah-langkah SQL berikut telah dijalankan:

1.  **Sinkronisasi Histori Migrasi Terlewat**:
    Mengosongkan tabel histori migrasi dan menulis ulang riwayat pendaftaran file migrasi dari `001` hingga `061` secara akurat agar runner migrasi tidak mencoba mengulang eksekusi migrasi yang merusak skema.
2.  **Penerapan SQL Kolom `jenis_gabah`**:
    Menjalankan script migrasi `042` secara manual untuk menambahkan kolom `jenis_gabah` di tabel `trx.batches` dan menyegarkan view `public.batches`.
3.  **Penyegaran Trigger Fungsi**:
    Menjalankan script migrasi `056` dan `057` untuk memperbarui logika trigger `handle_delivery_item_change()` agar mereferensikan kolom `weight_kg` (bukan `quantity_kg`).
4.  **Eksekusi Migrasi Baru**:
    Menjalankan `npm run migrate` untuk mengeksekusi sisa migrasi dari `062` sampai `069` secara bertahap untuk menambahkan kolom verifikasi status kas harian di PostgreSQL.
