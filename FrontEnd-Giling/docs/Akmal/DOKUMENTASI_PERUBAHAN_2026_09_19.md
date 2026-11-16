# Dokumentasi Perubahan Frontend (19 September 2026)

Dokumen ini merangkum seluruh perubahan dan peningkatan yang telah diimplementasikan pada antarmuka pengguna (Frontend) aplikasi **Belanja Giling Management System** pada tanggal 19 September 2026.

---

## 1. Penambahan Section Bagan Akun (12 Chart of Accounts Grid)

### Lokasi File:
- [`src/pages/FinanceDashboard.tsx`](file:///c:/GAWEEE/HETI%20SY/src/FrontEnd-Giling/src/pages/FinanceDashboard.tsx)
- [`src/pages/COAList.tsx`](file:///c:/GAWEEE/HETI%20SY/src/FrontEnd-Giling/src/pages/COAList.tsx)

### Latar Belakang & Kebutuhan:
Sebelumnya, hanya sebagian akun keuangan yang ditampilkan di dashboard utama, sehingga pengguna/manajer keuangan kesulitan memantau rincian saldo buku besar dari seluruh akun CoA pabrik secara transparan.

### Rincian Implementasi:
1. **Grid 12 Akun Terpadu (`FinanceDashboard.tsx`)**:
   - Menambahkan Section 3 khusus untuk menampilkan seluruh 12 akun keuangan (*Chart of Accounts*) yang terdaftar di sistem.
   - **Filter Kategori Dinamis**: Tab filter interaktif (`Semua`, `Aset`, `Kewajiban`, `Ekuitas`, `Pendapatan`, `Beban`).
   - **Fitur Pencarian Real-Time**: Input pencarian responsif berdasarkan kode akun atau nama akun.
   - **Visualisasi Saldo Buku Besar**: Setiap kartu menampilkan kode akun (misal: `1-100`, `1-300`, `4-100`), nama akun, kategori, dan saldo komitmen riil (*committed balance*) dari jurnal yang telah disetujui (*APPROVED*).
2. **Kolom Saldo di Halaman Daftar Akun (`COAList.tsx`)**:
   - Menambahkan kolom **"Saldo Buku Besar"** pada tabel utama `/finance/accounts` dengan format mata uang rupiah dan indikasi warna (Emerald untuk saldo positif/aset lancar).

---

## 2. Unifikasi Section Laba/Rugi & Kinerja Operasional (Eliminasi Duplikasi)

### Lokasi File:
- [`src/pages/FinanceDashboard.tsx`](file:///c:/GAWEEE/HETI%20SY/src/FrontEnd-Giling/src/pages/FinanceDashboard.tsx)

### Latar Belakang Masalah:
Sebelumnya terdapat dua section besar yang saling bersebelahan/berurutan yang menyajikan informasi bertumpuk (*overlap*), yaitu:
- *Card 1*: Menampilkan Laba/Rugi Operasional, Gross Margin, Operating Margin, Revenue, HPP, dan OPEX.
- *Card 2*: Mengulang angka Laba Operasional Bersih yang persis sama, mengulang persentase Gross & Operating Margin yang sama, serta menampilkan Laba Kotor dan Modal Belanja Gabah.

### Solusi Desain Baru:
Kedua section tersebut disatukan menjadi **1 Card Performa Operasional Komprehensif** dengan tata letak visual modern:
1. **Hero Header (Kiri Atas)**:
   - Judul & Badge: `Laba Operasional Bersih (Net Operating Profit) • [Hari Ini / Bulan Ini]`.
   - Angka Utama (*Hero Figure*): `formatCurrency(report.summary.operatingProfit)` (Warna Emerald jika laba, Rose jika rugi).
   - Penjelasan informatif alur laba operasional bersih.
2. **Indikator Rasio Margin (Kanan Atas)**:
   - Kotak statistik modern (*glassmorphism*) untuk **Gross Margin (%)** dan **Operating Margin (%)** tanpa pengulangan elemen.
3. **Rincian Alur Laba Rugi Sekuensial (5 Kolom Seimbang)**:
   - **1. Revenue (Penjualan Bersih)**: Total omset penjualan beras & hasil sampingan.
   - **2. HPP / COGS**: Beban pokok barang terjual.
   - **3. Laba Kotor (Gross Profit)**: Selisih penjualan dikurangi HPP (`Revenue - HPP`).
   - **4. Total OPEX**: Akumulasi seluruh beban operasional (pengeringan, penggilingan, logistik, dan operasional umum).
   - **5. Modal Kerja (Belanja Gabah)**: Nilai arus kas pembelian gabah pada periode terpilih.

---

## 3. Integrasi Tampilan "Analisis Margin per Batch"

### Lokasi File:
- [`src/pages/FinanceDashboard.tsx`](file:///c:/GAWEEE/HETI%20SY/src/FrontEnd-Giling/src/pages/FinanceDashboard.tsx)

### Peningkatan:
- Memastikan tabel Analisis Margin per Batch merender data finansial per lot gabah dengan tepat:
  - **ID Batch & Tanggal**: Tautan cepat ke detail batch dengan status badge (`CLOSED` / `ACTIVE`).
  - **Revenue (Sales)**: Menampilkan omset penjualan beras nyata (misal: **Rp 227.400.000** untuk batch `1863a4bc`).
  - **Total HPP (COGM)**: Menampilkan total modal produksi kumulatif (bahan baku + logistik + pengeringan + penggilingan).
  - **Net Margin**: Menampilkan selisih laba/rugi bersih per batch dengan badge warna dinamis (Emerald jika untung, Rose jika rugi).

---

## 4. Validasi & Pengujian

- **Kompilasi TypeScript & Vite Build**:
  ```bash
  npm run build
  ```
  - **Hasil**: Sukses 100% tanpa error (`Exit code 0`, 0 lint/type errors).
- **Pengujian Antarmuka Pengguna (UI E2E Browser Subagent)**:
  - Tampilan dashboard berjalan mulus, data reaktif terhadap filter tanggal, dan tabel batch margin terisi lengkap.
