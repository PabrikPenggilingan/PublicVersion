# Dokumentasi Modul: Admin System Monitoring (Overview, Requirements & Feature Logic)
**Tanggal:** 21 September 2026  
**Target Pembaca:** Human / Product Owner / Tech Lead / Developer  
**Status:** Production Ready  

---

## 1. Latar Belakang & Kebutuhan Bisnis (*Requirements*)

Sistem **Belanja Giling Management System** telah menangani transaksi operasional inti penggilingan padi: pembelian gabah basah, pengeringan (jemur), penggilingan padi menjadi beras, penjualan beras, dan pencatatan buku besar akuntansi.

Seiring berjalannya operasional dan bertambahnya data serta dokumen fisik (struk timbang, foto nota, bukti transfer), tim manajemen membutuhkan visibilitas mendalam ke dalam kondisi kesehatan infrastruktur dan aktivitas operasional tanpa harus selalu mengakses console cloud (GCP/Supabase) secara manual.

### Kebutuhan Utama (*Core Requirements*):
1. **Atribusi & Pemantauan Pengguna (*User Activity Tracking*):**
   - Mengetahui siapa saja pengguna sistem, peran mereka, kapan terakhir aktif, berapa banyak batch/pembelian/penjualan yang dibuat, dan berapa banyak file/kuota storage yang diunggah oleh masing-masing pengguna.
2. **Kesehatan Database (*PostgreSQL Health & Growth*):**
   - Mengetahui kapasitas total database, status koneksi (aktif vs *idle*), tabel-tabel terbesar yang memakan ruang, dan laju pertumbuhan data mingguan.
3. **Kapasitas Penyimpanan Berkas (*Supabase Storage Monitoring*):**
   - Mengetahui ukuran riil berkas foto dan dokumen di cloud bucket Supabase, rincian per folder kategori (`struk`, `gabah`, `proses`, `hasil`, `retur`), berkas-berkas terbesar, serta laju pertumbuhan storage.
4. **Performa Infrastruktur Komputasi (*GCP Cloud Run Computing*):**
   - Memantau penggunaan CPU, memory RAM, jumlah request, latensi P99, dan jumlah instance container Cloud Run baik untuk environment Production (`gabah-api`) maupun Staging (`gabah-api-staging`).
5. **Keamanan & Isolasi Hak Akses (*Security & Super Admin Guard*):**
   - Modul ini berisi data sensitif infrastruktur dan operasional, sehingga **hanya boleh diakses oleh pengguna dengan status Super Admin**. Pengguna biasa (admin biasa, operator, viewer) tidak boleh melihat tombol navigasi ataupun mengakses endpoint API ini.

---

## 2. Ikhtisar Fitur (*Feature Overview*)

Modul System Monitoring dirancang sebagai dashboard terpadu yang dapat diakses di URL **`/system-monitoring`** atau melalui tombol khusus di halaman **Master Akses Pengguna (`/master-page`)**.

Dashboard ini terbagi menjadi 5 tab utama:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SYSTEM MONITORING DASHBOARD                     │
├─────────────┬─────────────┬─────────────┬──────────────┬───────────────┤
│ 1. Overview │  2. Users   │ 3. Database │  4. Storage  │ 5. Computing  │
└─────────────┴─────────────┴─────────────┴──────────────┴───────────────┘
```

### Tab 1: Ringkasan Global (*Overview*)
- **Kartu Metrik Utama:**
  - Total Pengguna terdaftar & komposisi per role (`admin`, `owner`, `operator`, `viewer`).
  - Ukuran database PostgreSQL & status koneksi *connection pool*.
  - Total ukuran berkas live storage di cloud bucket Supabase.
  - Status kesehatan container Cloud Run (CPU, Memory, Active Instances).
- **Tabel Ringkas Pengguna:** Daftar pengguna dan total aktivitas transaksi terakhir.

### Tab 2: Aktivitas Pengguna (*Users*)
- Tabel komprehensif seluruh staf/pengguna:
  - Username, Role, Status Akun.
  - Jumlah Batch, Pembelian, Penjualan yang ditangani.
  - Jumlah file yang diunggah dan akumulasi ukuran storage (MB).
  - Waktu aktivitas terakhir (*last seen*).
- **Modal Detail Pengguna:** Saat baris pengguna diklik, muncul modal interaktif yang menampilkan grafik tren aktivitas mingguan (8 minggu terakhir) beserta breakdown histori log aksinya.

### Tab 3: Database PostgreSQL (*Database*)
- **Ringkasan:** Total database size (MB/GB), nama database aktif, koneksi total, aktif, dan *idle*.
- **Tabel Ukuran Relasi (*Table Sizes*):** Menampilkan 10 tabel terbesar lengkap dengan ukuran data murni vs ukuran index (misal: `trx.journal_lines`, `trx.inventory_items`, `log.activity`).
- **Penghitung Baris (*Row Counts*):** Jumlah rekod riil pada tabel-tabel operasional utama.
- **Tren Pertumbuhan Data (*Growth Trend*):** Grafik batang pertumbuhan input data transaksi selama 12 minggu terakhir.

### Tab 4: Cloud Storage (*Supabase Storage*)
- **Badge Status Sumber Data:**
  - 🟢 *Hijau (Akurat):* Berasal langsung dari Supabase Storage Bucket API.
  - 🟡 *Kuning (Estimasi):* Menggunakan metadata tabel database `trx.files` jika bucket kosong/layanan storage belum aktif.
- **Kartu Ringkasan:** Total file, Total size dalam MB dan GB.
- **Distribusi per Folder:** Grafik batang dan tabel ukuran data per kategori:
  - `struk/` (Foto struk timbang pembelian)
  - `gabah/` (Foto kondisi fisik gabah)
  - `proses/` (Foto dan berkas penggilingan)
  - `hasil/` (Foto hasil beras jadi)
  - `retur/` (Foto bukti barang retur)
- **Top 10 File Terbesar:** Daftar file dengan ukuran byte tertinggi untuk audit efisiensi kuota.
- **Storage per User:** Akumulasi kuota penyimpanan yang dihabiskan oleh masing-masing user pengunggah.
- **Auto-Create Bucket:** Jika bucket belum pernah dibuat di dashboard Supabase, backend otomatis membuatkan bucket `gabah-files` via Admin API.

### Tab 5: Komputasi Server (*GCP Cloud Run Computing*)
- **Environment Switcher:** Tombol toggle instan untuk beralih antara:
  - `Production (gabah-api)`
  - `Staging (gabah-api-staging)`
- **Rentang Waktu Dinamis (*Time Window*):** `30m` (30 menit), `1h` (1 jam), `3h`, `6h`, hingga `24h` (24 jam).
- **Indikator Status:** Badge hijau `GCP Connected` saat API Google Cloud Monitoring terhubung dengan sukses.
- **Kartu & Gauge Metrik:**
  - Utilisasi CPU saat ini (%).
  - Utilisasi RAM/Memory saat ini (%).
  - Total Request HTTP yang diterima Cloud Run.
  - Jumlah Active Instances (skala container yang sedang menyala).
  - P99 Response Latency (kecepatan respons server dalam milidetik).
- **Grafik Tren CPU (Time Series):** Grafik batang distribusi beban CPU menit-ke-menit.
- **State Idle Informatif:** Jika traffic sedang sepi dan Cloud Run melakukan *scale-to-zero* (0 instance), UI menampilkan penjelasan ramah bahwa server sedang standby alih-alih menampilkan pesan error yang membingungkan.

---

## 3. Logika Bisnis & Alur Kerja (*Feature Logic*)

### A. Mekanisme Hak Akses Super Admin
- **Prinsip Desain:** Sistem tidak menambahkan role string baru pada enum database (`admin`, `owner`, `operator`, `viewer` tetap utuh). Hak istimewa ini diimplementasikan menggunakan boolean flag **`is_super_admin = true`** pada tabel `sys.users`.
- **Alur Login:**
  1. Pengguna login via `/api/auth/login`.
  2. Backend mengambil `is_super_admin` dari tabel `sys.users` dan menyuntikkannya ke dalam JWT Token payload dan respons DTO (`AuthResponseDTO` & `UserResponseDTO`).
  3. Frontend menyimpan status `currentUser.is_super_admin`.
  4. Komponen `MasterPage.tsx` memeriksa `currentUser.is_super_admin`. Tombol menuju `/system-monitoring` hanya dirender jika nilainya `true`.
  5. Setiap panggilan API di `/api/admin/*` diverifikasi ganda di sisi backend oleh middleware `requireSuperAdmin`. Request dari pengguna tanpa flag ini langsung ditolak dengan HTTP 403 Forbidden.

### B. Atribusi Storage per Pengguna (*File Ownership Tracking*)
- Sebelumnya, tabel `trx.files` tidak mencatat siapa user yang mengunggah file.
- Melalui migration `091_add_created_by_to_files.sql`:
  - Kolom `created_by UUID REFERENCES sys.users(id)` ditambahkan ke `trx.files`.
  - Data lama dibackfill secara otomatis:
    - Berkas pembelian dihubungkan ke `purchases.filled_by`.
    - Berkas proses jemur/giling dihubungkan ke `processes.created_by`.
    - Berkas penjualan dihubungkan ke `sales.created_by`.
  - Unggahan baru melalui `files.controller.js` otomatis mengisikan `createdBy = req.user.id`.
  - Dengan demikian, dashboard dapat menghitung konsumsi kuota penyimpanan per staf secara presisi.

### C. Strategi *Graceful Degradation* (Ketahanan Sistem)
Infrastruktur backend terhubung ke beberapa layanan pihak ketiga (PostgreSQL, Supabase, Google Cloud Platform). Kegagalan pada salah satu layanan tidak boleh meruntuhkan seluruh dashboard:
- Jika Supabase Storage key belum diisi: Tab Storage tetap menyajikan estimasi akurat dari tabel database PostgreSQL (`source: 'database_metadata'`).
- Jika kredensial GCP Monitoring belum aktif di komputer lokal: Tab Computing menampilkan panduan setup lokal yang jelas dan informatif, tanpa pernah memicu HTTP 500 (*Internal Server Error*).
- Kegagalan query di satu domain diisolasi sepenuhnya menggunakan `Promise.allSettled()`.

### D. Strategi Caching In-Memory (Penghematan Kuota & Performa)
Panggilan ke GCP Cloud Monitoring API dan Supabase Storage API memerlukan waktu jaringan dan memiliki kuota rate-limit.
- Backend menerapkan kelas singleton `AdminMonitoringCache` dengan masa berlaku (*TTL*):
  - Ringkasan (*Overview*): 2 Menit (120s)
  - Pengguna (*Users*): 5 Menit (300s)
  - Database (*Database*): 5 Menit (300s)
  - Storage (*Storage*): 10 Menit (600s)
  - Komputasi (*Computing*): 2 Menit (120s)
- Pengguna dapat memaksa refresh data seketika dengan menekan tombol **Refresh** di pojok kanan atas dashboard, yang akan memicu invalidasi cache dan penarikan data baru dari provider cloud.
