# Developer Handover & Knowledge Transfer
**Sistem Manajemen Penggilingan Padi — Belanja Giling**

Dokumen ini disusun untuk developer selanjutnya agar dapat memahami arsitektur, alur bisnis, dan peta kode secara cepat dan menyeluruh.

---

## 1. Stack Teknologi & Arsitektur

| Layer | Teknologi | Catatan |
|---|---|---|
| **Backend** | Node.js, Express.js | REST API, pattern MVC-like |
| **Database** | PostgreSQL | Raw query + SQL migrations, tanpa ORM |
| **Frontend** | React 18, Vite, TypeScript | Dark mode, Tailwind CSS |
| **Auth** | JWT (jsonwebtoken) | Role: `admin`, `operator`, `viewer` |
| **File Upload** | Multer | Foto bukti disimpan lokal di `/uploads` |
| **Containerization** | Docker + Docker Compose | Development mode (bind mounts + hot-reload) |

### Skema Database
Database dibagi menjadi **3 schema PostgreSQL**:
- `trx` — Semua tabel transaksi: `batches`, `purchases`, `inventory_items`, `inventory_sacks`, `drying_processes`, `processes`, dll.
- `mst` — Master data: `item_categories` (GABAH, BERAS, DEDAK, MENIR, LIMBAH)
- `sys` — Data sistem: `users`, `batch_links`, `purchase_photos`, dll.
- `log` — Log history aktivitas

### Struktur Folder Backend
```
backend/
├── src/
│   ├── config/        # env.js (konfigurasi), database.js (koneksi pool)
│   ├── controllers/   # Handler HTTP request/response
│   ├── services/      # ⭐ Business logic utama ada di sini
│   ├── models/        # Query SQL ke database
│   ├── routes/        # Definisi endpoint API
│   ├── middleware/    # auth.js (JWT), errorHandler.js
│   └── utils/         # helpers.js, errors.js
├── migrations/        # 043 file SQL migrasi (dijalankan berurutan)
├── scripts/           # migrate.js, seed.js
└── uploads/           # Foto-foto yang diupload user
```

---

## 2. Alur Bisnis Produksi (State Machine)

Alur gabah dari pembelian hingga menjadi produk jual, digambarkan sebagai berikut:

```mermaid
flowchart TD
    A([🌾 Mulai: Petani Disurvei]) --> B[Pendataan Lapangan\n/pendataan]
    B --> C[Buat Batch Pembelian\n/batches]
    C --> D[Input Data Pembelian\nper Petani / Calo]

    D --> E{Kondisi Gabah?}

    E -->|Gabah Basah / Perlu Jemur| F[Buat Proses Pengeringan\n/drying]
    F --> F2[Form Lapangan: Mulai & Selesai Jemur]
    F2 --> F3[Admin Approve Pengeringan]
    F3 --> G

    E -->|Gabah Sudah Kering| G

    G[Transfer ke Gudang\nTombol: Transfer ke Gudang\ndi halaman Batch Detail]
    G --> H[(Inventory Gudang\ntrx.inventory_items\nStatus: AVAILABLE)]

    H --> I[Pilih Gabah untuk Digiling\n/processes → Buat Baru]
    I --> J[Status Gabah: RESERVED\nTidak bisa digiling/dijual lagi]
    J --> K[Proses Giling Berjalan\n/processes/:id]
    K --> L[Input Biaya: Listrik, Jasa, dll]
    L --> M[Selesai Giling: Input Output]

    M --> N{Output Produk}
    N --> O[🍚 Beras\nKategori BERAS\nTracking per Karung]
    N --> P[🟤 Dedak\nKategori DEDAK\nTracking per Kg]
    N --> Q[💛 Menir\nKategori MENIR\nTracking per Kg]
    N --> R[💨 Sekam\nKategori LIMBAH\nDicatat, tidak masuk stok]

    O --> S[📦 Stok Gudang Siap Jual]
    P --> S
    Q --> S
    S --> T([✅ Selesai: Bisa Dijual])
```

---

## 3. Alur Navigasi Halaman Frontend (Page Flow)

```mermaid
graph TD
    Login --> Auth{JWT Valid?}
    Auth -->|Gagal| Login
    Auth -->|Sukses| Dashboard

    Dashboard --> Pendataan[/pendataan\nData Lapangan]
    Dashboard --> Batch[/batches\nPembelian Gabah]
    Dashboard --> Drying[/drying\nPengeringan]
    Dashboard --> Inventory[/inventory\nGudang]
    Dashboard --> Processes[/processes\nMesin Giling]
    Dashboard --> Users[/users\nManajemen User]

    Batch -->|Klik baris| BatchDetail[BatchDetail\nDaftar pembelian + foto]
    BatchDetail -->|Status CLOSED + sisa stok| TransferModal[Modal: Transfer ke Gudang\nInput tonase yang ditransfer]
    BatchDetail -->|Kelola Link Form| BatchLinks[Link Form Lapangan\nUntuk Employee]

    Drying -->|Klik baris| DryingDetail[DryingDetail\nSession START dan END]
    DryingDetail -->|Selesai COMPLETED| TransferDrying[Tombol: Simpan ke Gudang\nTransfer dari Pengeringan]

    Inventory -->|Klik baris| InventoryDetail[InventoryDetail\nDetail stok + history]
    InventoryDetail -->|Kategori GABAH| TakeWeight[Modal: Take Weight\nAmbil stok kg]
    InventoryDetail -->|Kategori BERAS| TakeSacks[Modal: Take Sacks\nAmbil per karung]
    InventoryDetail -->|Tombol Giling| Processes

    Processes -->|Buat Baru| PickGabah[Pilih Gabah AVAILABLE\nFIFO dari Inventory]
    Processes -->|Klik baris| ProcessDetail[ProcessDetail\nDetail sesi giling]
    ProcessDetail -->|Tab Biaya| InputBiaya[Input HPP: Listrik, Jasa]
    ProcessDetail -->|Tombol Selesai| InputOutput[Input Beras, Dedak, Menir, Sekam\nKalkulasi Rendemen & HPP Otomatis]
```

---

## 4. Aturan Bisnis Kritis (Wajib Dipahami)

### 4.1 Sumber Gabah ke Gudang
Gabah masuk ke `trx.inventory_items` hanya melalui **2 jalur resmi**:
1. **Dari Pengeringan** (`source_type: 'drying'`) — via tombol "Simpan ke Gudang" di `DryingDetail.tsx`
2. **Langsung dari Batch** (`source_type: 'batch'`) — via tombol "Transfer ke Gudang" di `BatchDetail.tsx`

Penambahan manual via form hanya untuk koreksi darurat dan hanya oleh Admin.

### 4.2 Beras TIDAK Boleh Input Manual
`BERAS` hanya bisa masuk ke inventory melalui proses penggilingan selesai (`completeProcess()`). Ada guard di backend untuk menolak pembuatan item beras secara manual.

### 4.3 Status Gabah di Gudang
| Status | Arti |
|---|---|
| `AVAILABLE` | Siap dipilih untuk digiling atau dijual |
| `RESERVED` | Sedang dikunci untuk proses giling yang sedang berjalan |
| `DEPLETED` | Stok habis |
| `VOID` | Dibatalkan / koreksi |

### 4.4 Tracking Berbeda per Kategori
| Kategori | Cara Tracking | Kenapa |
|---|---|---|
| GABAH | Bulk weight (kg) | Tidak per-karung, hanya total tonase |
| BERAS | Per karung (sack) + ukuran (kg/karung) | Perlu tahu jumlah fisik karung untuk jual |
| DEDAK | Bulk weight (kg) | Dijual per kg |
| MENIR | Bulk weight (kg) | Dijual per kg |
| LIMBAH/SEKAM | Dicatat, tidak masuk stok | Tidak dijual |

### 4.5 Kalkulasi HPP & Rendemen (Otomatis saat Selesai Giling)
```
Rendemen (%) = (Total Output Beras kg / Total Gabah Input kg) × 100

HPP per kg   = (Total Harga Beli Gabah + Total Biaya Tambahan) / Total Output Beras
```
Kalkulasi ini dijalankan di `backend/src/services/process.service.js` → method `completeProcess()`.

---

## 5. Peta Kode (Code Compass)

> Cari fitur apa → edit file mana

| Fitur / Modul | Backend | Frontend |
|---|---|---|
| **Pembelian Batch** | `batch.service.js`, `batches.controller.js` | `Batches.tsx`, `BatchDetail.tsx` |
| **Pengeringan** | `drying.service.js`, `drying.controller.js` | `DryingList.tsx`, `DryingDetail.tsx` |
| **Gudang (Inventory)** | `inventory.service.js`, `inventory.controller.js` | `InventoryList.tsx`, `InventoryDetail.tsx` |
| **Transfer Batch→Gudang** | `inventory.service.js` → `createFromBatch()` | `BatchDetail.tsx` → tombol "Transfer ke Gudang" |
| **Transfer Drying→Gudang** | `inventory.service.js` → `createFromDrying()` | `DryingDetail.tsx` → tombol "Simpan ke Gudang" |
| **Mesin Giling** | `process.service.js`, `processes.controller.js` | `Processes.tsx`, `ProcessDetail.tsx` |
| **HPP & Biaya** | `process.service.js` → `completeProcess()` | Tab "Biaya" di `ProcessDetail.tsx` |
| **Ambil Stok (BERAS)** | `inventory.service.js` → `takeSacks()` | Modal TakeSacks di `InventoryDetail.tsx` |
| **Ambil Stok (GABAH/dll)** | `inventory.service.js` → `takeWeight()` | Modal TakeWeight di `InventoryDetail.tsx` |
| **Auth & User** | `auth.controller.js`, `users.controller.js` | `Login.tsx`, `Users.tsx` |
| **Semua API calls** | — | `src/api/client.ts` |
| **Database migrations** | `backend/migrations/*.sql` (043 files) | — |

---

## 6. Environment Variables

File `.env` dibaca dari `BackEnd-Giling/.env`. Variabel yang dibutuhkan:

```env
NODE_ENV=development
PORT=3000

DATABASE_URL=postgresql://postgres:12345678@localhost:5432/gabah_db
LOG_DATABASE_URL=postgresql://postgres:12345678@localhost:5432/gabah_db

JWT_SECRET=ganti-dengan-string-acak-yang-panjang
JWT_EXPIRES_IN=7d

# Cloudflare R2 (foto cloud storage — opsional)
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_ENDPOINT=
```

> Saat berjalan via Docker, variabel ini sudah di-inject oleh `docker-compose.yml` sehingga tidak perlu file `.env` manual.

---

## 7. Docker Development Setup

Seluruh sistem berjalan dalam **Development Mode** di Docker:
- **Bind Mounts**: Kode sumber di laptop terhubung langsung ke container — hot-reload bekerja seperti biasa.
- **Isolated `node_modules`**: Dependencies container tidak bercampur dengan laptop (penting untuk kompatibilitas Windows/Linux).
- **Auto-migration**: Container backend menjalankan `npm run migrate` setiap kali start.

```bash
# Jalankan sistem
docker-compose up

# Lihat log realtime
docker-compose logs -f backend

# Reset database (hapus semua data!)
docker-compose down -v && docker-compose up
```

---

## 8. Status Pengembangan

| Modul | Status | Catatan |
|---|---|---|
| Pendataan Lapangan | ✅ Selesai | |
| Pembelian / Batch | ✅ Selesai | Termasuk form employee via link |
| Transfer Batch → Gudang | ✅ Selesai | Jalur langsung tanpa drying |
| Pengeringan (Drying) | ✅ Selesai | Form lapangan + approval admin |
| Transfer Drying → Gudang | ✅ Selesai | |
| Inventory Gudang | ✅ Selesai | FIFO, multi-kategori |
| Mesin Giling + HPP | ✅ Selesai | Kalkulasi otomatis |
| Manajemen User | ✅ Selesai | |
| **Modul Penjualan (Sales)** | 🔄 Belum | Dalam antrian development |
| **Modul Keuangan (Finance)** | 🔄 Belum | Menunggu Sales selesai |

---

*Fokus pertahankan prinsip **traceability** — setiap benda fisik (gabah, beras) dan uang harus bisa dilacak asal-usulnya dari pembelian hingga penjualan.*
