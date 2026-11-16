# Backend Handoff Guide - Finance Redesign
**Penulis**: Antigravity (Google DeepMind)  
**Tujuan**: Panduan cepat bagi developer untuk meninjau penambahan endpoint API baru, relasi tabel operasional, dan transaksi database keuangan.

---

## 📂 Struktur File Backend Keuangan
Jika Anda ingin memodifikasi logika bisnis atau API keuangan, fokus pada 3 file berikut:

1.  **Daftar Route (`finance.routes.js`)**:
    *   **Lokasi**: [`src/routes/finance.routes.js`](file:///c:/GAWEH/COLLECT%20DATA%20GABAH/src/BackEnd-Giling/backend/src/routes/finance.routes.js)
    *   **Peran**: Mengarahkan URL request dari frontend ke controller yang tepat.
2.  **Controller (`finance.controller.js`)**:
    *   **Lokasi**: [`src/controllers/finance.controller.js`](file:///c:/GAWEH/COLLECT%20DATA%20GABAH/src/BackEnd-Giling/backend/src/controllers/finance.controller.js)
    *   **Peran**: Menerima request HTTP, memvalidasi parameter dasar, memanggil fungsi service, dan mengirim respons JSON.
3.  **Service / Logika Bisnis (`finance.service.js`)**:
    *   **Lokasi**: [`src/services/finance.service.js`](file:///c:/GAWEH/COLLECT%20DATA%20GABAH/src/BackEnd-Giling/backend/src/services/finance.service.js)
    *   **Peran**: Berisi kueri database (SQL), kalkulasi saldo, manajemen state transaksi, dan penanganan error.

---

## 🛠️ Rincian 3 API Baru (Practical Quick Review)

### 1. GET `/api/finance/transactions/:id` (Detail Relasi Transaksi)
*   **Tujuan**: Menjawab keluhan *"part belum connect antar table"*. API ini mencari transaksi kas di ledger, lalu secara otomatis mencari informasi detail ke tabel asal berdasarkan kolom `source_module`.
*   **Cara Kerja Kueri**:
    *   Kueri pertama mengambil data dari `trx.finance_transactions`.
    *   Berdasarkan nilai `source_module`, server melakukan kueri lanjutan:
        *   `SALES` $\to$ Menghubungkan `reference_id` dengan `trx.sale_payments` untuk mengambil nota penjualan & nama pelanggan.
        *   `PURCHASE` $\to$ Menghubungkan `reference_id` dengan `trx.purchase_payments` untuk mengambil info belanja gabah & nama calo.
        *   `PROCESS` $\to$ Menghubungkan `id` transaksi dengan `trx.process_costs` untuk mengambil rincian biaya giling (solar/kuli) dan nomor gilingan.
        *   `DRYING` $\to$ Menghubungkan `id` transaksi dengan `trx.drying_costs` untuk mengambil rincian biaya jemur.
        *   `LOGISTICS` $\to$ Menghubungkan `id` transaksi dengan `trx.logistics_tasks` untuk mengambil data sopir & rute.
        *   `OVERHEAD` $\to$ Menghubungkan `reference_id` dengan `trx.overhead_expenses` untuk mengambil rincian operasional pabrik.

---

### 2. POST `/api/finance/transfer` (Transfer Dana Internal)
*   **Tujuan**: Memindahkan saldo dari satu rekening kas ke rekening kas lainnya secara aman.
*   **Penting (Transaksional)**: Menggunakan database client transaksional (`BEGIN ... COMMIT`) untuk mencegah kegagalan parsial (misal: uang berkurang dari rekening A tetapi gagal bertambah ke rekening B).
*   **Langkah Logika**:
    1.  Membuka koneksi transaksional (`BEGIN`).
    2.  Memvalidasi saldo dan status aktif rekening asal (`fromAccountId`) & tujuan (`toAccountId`).
    3.  Membuat entri `OUT` (Kas Keluar) pada rekening asal (Langsung `APPROVED`).
    4.  Membuat entri `IN` (Kas Masuk) pada rekening tujuan (Langsung `APPROVED`).
    5.  Melakukan update saldo masing-masing rekening kas.
    6.  Menyimpan perubahan permanen (`COMMIT`). Jika ada langkah yang gagal, otomatis dilakukan pembatalan menyeluruh (`ROLLBACK`).

---

### 3. POST `/api/finance/transactions/manual` (Jurnal Koreksi / Modal)
*   **Tujuan**: Mencatat kas masuk/keluar secara manual oleh Manajer Keuangan (penambahan modal pemilik atau pembukuan manual lainnya).
*   **Cara Kerja**:
    *   Membuat transaksi kas langsung dengan status `APPROVED` (melewati antrean persetujuan).
    *   Otomatis memicu update saldo kas fisik pada `trx.finance_accounts` secara instan.

---

## 💡 Tips Cepat untuk Developer Backend
*   **Status Keuangan**: Tabel `trx.finance_transactions` memiliki kolom `status` dengan nilai `PENDING`, `APPROVED`, dan `REJECTED`. Hanya transaksi berstatus `APPROVED` yang dihitung ke dalam saldo fisik rekening kas.
*   **Error Handler**: Gunakan helper `asyncHandler` di controller untuk menangkap error secara global. Jika ingin memicu error validasi, gunakan `throw new ValidationError('Pesan error dalam bahasa Indonesia')` agar ditangkap dan dikirim sebagai respons HTTP 400 ke frontend.
