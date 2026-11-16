# Ringkasan Perubahan Logika: Evolusi Finance Center

Dokumen ini merangkum evolusi besar (*major changes*) pada inti bisnis logika sistem kita, khususnya terkait transisi sistem pencatatan keuangan ke *Double-Entry Journaling* dan pengamanan fungsi penomoran otomatis nota.

---

## 1. Transisi ke "Double-Entry Journaling" Secara Penuh
**Kondisi Lama:**
Sebelumnya, modul-modul operasional (seperti Pembelian Gabah, Penggilingan, dan Penjualan Beras) hanya menggunakan fungsi *single-entry* (`createTransaction`). Setiap kali ada transaksi, kita cuma nyatet "ada duit keluar" atau "ada duit masuk" secara satu dimensi tanpa memetakan akun debit dan kreditnya secara ketat.

**Logika Baru:**
Kita merombak fondasi pencatatan! Semua fungsi operasional (Pembelian, Penggilingan, Penjualan) kini terintegrasi langsung dengan logika akuntansi berpasangan (*Double-Entry Journaling*).
Sistem secara otomatis memanggil fungsi `financeModel.createJournalEntry` di belakang layar dan merangkai posisi Debit dan Kredit:
- **Modul Pembelian (Purchase):** Membentuk jurnal masuk. Sistem otomatis menarik akun `1-300` (Persediaan Gabah) sebagai Debit dan akun `2-100` (Hutang Usaha/AP) sebagai Kredit.
- **Modul Penggilingan (Milling):** Membentuk jurnal biaya. Sistem menarik akun `5-400` (Beban Giling) sebagai Debit.
- **Modul Penjualan (Sales):** Membentuk jurnal pendapatan. Sistem menarik akun `1-200` (Piutang Usaha/AR) sebagai Debit dan `4-100` (Pendapatan) sebagai Kredit.

Semua jurnal ini status awalnya dikunci sebagai **PENDING** sebelum Manajer Keuangan memvalidasinya di *Finance Center*. Karena jurnal ini masih *PENDING*, nilai dari Piutang, Hutang, Persediaan, dan OPEX **belum** akan memengaruhi angka-angka final di UI Dashboard Keuangan. Dashboard murni hanya mengalkulasi data yang status jurnalnya sudah **APPROVED**.

---

## 2. Refactoring Logika Laporan Harian (Daily Report P&L)
**Kondisi Lama:**
PDF laporan harian sebelumnya menyatukan semua jenis biaya tanpa pemisahan yang jelas, sehingga modal beli gabah (yang sebetulnya bisa jadi persediaan) tercampur mengurangi laba operasional secara mentah.

**Logika Baru:**
Di `pdf.service.js`, kita mengubah logika kalkulasi P&L:
1. Kita mendefinisikan batas tegas antara **Laba Operasional** (*Operating Profit / EBITDA*) dengan pos belanja gabah. Laba Operasional murni dihitung dari *Revenue* dikurangi HPP (COGS) dan Total OPEX.
2. Kita melahirkan metrik baru bernama **Laba Bersih Riil** (*Net Real Profit*). Angka ini didapat dari Laba Operasional dikurangi Modal Belanja Gabah (`procurement`). Pemisahan ini memberikan *insight* yang jauh lebih akurat buat *owner* mengenai seberapa sehat margin operasi pabrik hari itu terlepas dari berapa banyak modal yang "nyangkut" untuk kulakan gabah mentah.

---

## 3. Resolusi Race Condition pada Auto-Numbering Nota
**Kondisi Lama:**
Sistem *auto-numbering* nota (`JUAL/YYYY/MM/XXX`) mengandalkan agregat simpel `SELECT COUNT(*) FROM sales`. Di lingkungan yang sepi pengguna, ini aman. Namun saat sistem digempur *request* paralel (seperti skenario *stress test* E2E kita), metode ini gagal total. Beberapa *request* membaca jumlah nota yang sama dan mencoba memakai nomor seri yang sama, memicu ledakan error `Duplicate entry`.

**Logika Baru:**
Kita membuat logika *Sequence Table* terisolasi. Penomoran kini di-*handle* oleh *Atomic Upsert* yang mengunci spesifik pada *prefix* bulan berjalan (Contoh: lock pada baris `JUAL/2026/08`), kemudian melakukan increment angka secara eksklusif. Antrean request di level mesin database berjalan sangat rapi, menggaransi nol persentase tabrakan nomor seri (*Zero-Collision Guarantee*)!
