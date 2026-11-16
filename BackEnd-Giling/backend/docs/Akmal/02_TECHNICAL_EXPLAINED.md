# Dokumentasi Teknis: Admin System Monitoring (Technical Architecture & Engineering Reference)
**Tanggal:** 21 September 2026  
**Target Pembaca:** Software Engineers, Backend/Frontend Developers, DevOps, System Architects  
**Versi Dokumen:** 1.0.0  
**Status:** Production Ready  

---

## 1. Arsitektur Sistem Tingkat Tinggi (*High-Level Architecture*)

Modul **System Monitoring** dibangun untuk mengintegrasikan metrik dari tiga tier infrastruktur utama:
1. **Application Layer (Cloud Run / Node.js Express)**
2. **Database Layer (Supabase Managed PostgreSQL 15+)**
3. **Object Storage Layer (Supabase Storage S3-Compatible API)**

Berikut adalah topologi interaksi komponen modul:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND CLIENT (React + Vite)                  │
│  - /system-monitoring (5 Tabs: Overview, Users, DB, Storage, Compute) │
│  - RBAC: is_super_admin check on AuthContext & LocalStorage Token     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS (Bearer JWT)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   EXPRESS API BACKEND (Cloud Run / Local)              │
│                                                                        │
│  [Middleware Pipeline]                                                 │
│   authenticateToken ──> superAdminLimiter (60/m) ──> requireSuperAdmin │
│                                                                        │
│  [Controller & Caching Layer]                                          │
│   adminMonitoring.controller.js <──> adminMonitoring.cache.js (In-Mem) │
│                                                                        │
│  [Service Layer - adminMonitoring.service.js]                          │
│        ├── PostgreSQL Model (adminMonitoring.model.js)                │
│        ├── Supabase Storage Client (@supabase/supabase-js)             │
│        └── GCP Cloud Monitoring Client (@google-cloud/monitoring)      │
└────────────┬──────────────────────┬──────────────────────┬─────────────┘
             │                      │                      │
             ▼                      ▼                      ▼
┌────────────────────────┐ ┌──────────────────┐ ┌────────────────────────┐
│  SUPABASE POSTGRESQL   │ │ SUPABASE STORAGE │ │  GOOGLE CLOUD PLATFORM │
│  - sys.users           │ │ - Bucket:        │ │ - Cloud Monitoring API │
│  - trx.files / batches │ │   gabah-files    │ │ - Metrics: CPU, RAM,   │
│  - pg_stat / pg_catalog│ │ - Service Role   │ │   Latencies, Instances │
└────────────────────────┘ └──────────────────┘ └────────────────────────┘
```

---

## 2. Keamanan & Akses Kontrol (*Security & RBAC*)

### 2.1 Mengapa Tidak Menambah Enum Role Baru?
Di database PostgreSQL sistem saat ini, role user dibatasi oleh PostgreSQL ENUM type `user_role` yang mencakup:
- `'admin'`
- `'owner'`
- `'operator'`
- `'viewer'`

Merubah enum langsung di production database memiliki risiko tinggi (*table locking*, potensi kegagalan migrasi jika terdapat dependensi fungsi/view). Oleh karena itu, arsitektur yang dipilih adalah **Feature Flag Column**:
```sql
ALTER TABLE sys.users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_users_is_super_admin ON sys.users(is_super_admin);
```
Dengan pendekatan ini:
- Role struktural organisasi (`admin`, `owner`) tetap utuh.
- Hak akses sistem infrastruktur hanya diberikan kepada user spesifik yang memiliki `is_super_admin = true`.

### 2.2 Middleware Stack & Guards
Setiap endpoint di bawah router `/api/admin/system/*` dilindungi oleh tiga lapis middleware berurutan:

```
Request ──> [1. authenticateToken] ──> [2. superAdminLimiter] ──> [3. requireSuperAdmin] ──> Controller
```

1. **`authenticateToken` (`backend/src/middleware/auth.js`):**
   - Memverifikasi signature JWT menggunakan secret key server.
   - Mengambil payload user (`req.user = decoded`).

2. **`superAdminLimiter` (`backend/src/middleware/rateLimiter.js`):**
   - Menggunakan `express-rate-limit`.
   - Dibatasi maksimum **60 request per menit per IP address**.
   - Mencegah *abuse*, *DoS*, atau pembebanan berlebih pada Google Cloud Monitoring API dan query berat database.

3. **`requireSuperAdmin` (`backend/src/middleware/superAdmin.js`):**
   - **Fast Path:** Memeriksa `req.user.is_super_admin === true` yang tertanam dalam payload token JWT.
   - **Defensive DB Fallback:** Jika field belum terisi di token JWT (misal token dibuat sebelum user dipromosikan), middleware melakukan query langsung ke database `sys.users` untuk memverifikasi nilai `is_super_admin` terkini:
     ```javascript
     const userRes = await db.query(
       'SELECT is_super_admin, is_active FROM sys.users WHERE id = $1',
       [userId]
     );
     ```
   - Jika `is_super_admin !== true` atau akun `is_active !== true`, server melempar respons `403 Forbidden`:
     ```json
     {
       "success": false,
       "message": "Akses ditolak. Fitur ini hanya dapat diakses oleh Super Administrator."
     }
     ```

---

## 3. Database Schema, Migrasi & Defensive Queries

### 3.1 Migrasi 090 (`backend/migrations/090_add_super_admin_flag.sql`)
Menambahkan kolom `is_super_admin` pada tabel `sys.users` beserta indeks B-Tree.

```sql
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sys' AND table_name = 'users' AND column_name = 'is_super_admin'
    ) THEN
        ALTER TABLE sys.users ADD COLUMN is_super_admin BOOLEAN NOT NULL DEFAULT false;
        CREATE INDEX IF NOT EXISTS idx_users_is_super_admin ON sys.users (is_super_admin);
    END IF;
END $$;
```

### 3.2 Migrasi 091 (`backend/migrations/091_add_created_by_to_files.sql`)
Menambahkan kolom `created_by` (UUID) pada tabel lampiran `trx.files` dan melakukan backfill otomatis:
- Menghubungkan relasi file pembelian (`source_type = 'purchase'`) dengan user pembuat transaksi pembelian (`trx.purchases.created_by`).
- Menghubungkan relasi file batch giling (`source_type = 'batch'`) dengan user pembuat batch (`trx.batches.created_by`).
- Default fallback ke pengguna dengan role `admin` atau `owner` pertama yang aktif.

```sql
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'trx' AND table_name = 'files' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE trx.files ADD COLUMN created_by UUID REFERENCES sys.users(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_trx_files_created_by ON trx.files (created_by);
    END IF;
END $$;
```

### 3.3 Defensive Querying (`(to_jsonb(f)->>'created_by')::uuid`)
Untuk mencegah terjadinya error fatal runtime 500 jika ada *race condition* atau penundaan eksekusi migrasi di environment tertentu, model database (`backend/src/models/adminMonitoring.model.js`) menggunakan defensive JSON casting:

```sql
SELECT 
    f.id,
    f.file_name,
    f.file_size,
    (to_jsonb(f)->>'created_by')::uuid AS created_by,
    u.username AS uploaded_by_username
FROM trx.files f
LEFT JOIN sys.users u ON u.id = (to_jsonb(f)->>'created_by')::uuid
ORDER BY f.file_size DESC LIMIT 10;
```
**Keuntungan Teknis:**
Jika kolom `created_by` belum ada secara fisik pada saat query berjalan, PostgreSQL tidak akan melempar error `column "created_by" does not exist`. Sebaliknya, `to_jsonb(f)->>'created_by'` mengembalikan nilai `NULL` secara aman.

### 3.4 Katalog PostgreSQL & Analisis Kapasitas
Untuk tab database, backend melakukan inspeksi langsung ke sistem katalog PostgreSQL:
- **Ukuran Total Database:** `SELECT pg_database_size(current_database())`
- **Koneksi Aktif & Idle:** `SELECT state, count(*) FROM pg_stat_activity WHERE datname = current_database() GROUP BY state`
- **Ukuran Tabel & Indeks:** 
  ```sql
  SELECT 
      schemaname || '.' || relname AS table_name,
      pg_total_relation_size(relid) AS total_bytes,
      pg_relation_size(relid) AS data_bytes,
      pg_indexes_size(relid) AS index_bytes
  FROM pg_catalog.pg_statio_user_tables
  ORDER BY pg_total_relation_size(relid) DESC LIMIT 10;
  ```
- **Tren Pertumbuhan Mingguan (Weekly Growth):** Menggunakan agregasi `date_trunc('week', created_at)` pada tabel transaksi utama (`trx.purchases`, `trx.batches`, `trx.sales`).

---

## 4. Lapisan Caching Dalam-Memori (*In-Memory Caching Layer*)

File: `backend/src/services/adminMonitoring.cache.js`

### 4.1 Desain & Spesifikasi Cache
Query metrik sistem (terutama GCP Cloud Monitoring API dan katalog tabel PostgreSQL) relatif berat dan tidak memerlukan presisi instan per milidetik. Sistem menerapkan caching internal berbasis RAM (Node.js Process Memory):

| Cache Key | TTL (Time-To-Live) | Alasan Teknis |
| :--- | :--- | :--- |
| `overview` | 60 detik (1 menit) | Menggabungkan data dari DB, Storage, dan GCP |
| `users` | 60 detik (1 menit) | Agregasi aktivitas staf & modal histori |
| `database` | 120 detik (2 menit) | Query katalog `pg_statio_user_tables` memerlukan scan sistem |
| `storage` | 180 detik (3 menit) | Traversal recursive API Supabase Storage |
| `computing_*` | 60 detik (1 menit) | GCP Cloud Monitoring memiliki kuota API gratis & interval polling |

### 4.2 Struktur Data & Eviction
```javascript
class MemoryCache {
  constructor() {
    this.cache = new Map();
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    return item.data;
  }

  set(key, data, ttlSeconds = 60) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }

  del(key) {
    this.cache.delete(key);
  }

  flush() {
    this.cache.clear();
  }
}
```

### 4.3 Endpoint Cache Invalidation
Super Admin dapat memaksa refresh data tanpa menunggu TTL berakhir melalui endpoint:
`POST /api/admin/system/cache/clear`
Endpoint ini memanggil `monitoringCache.flush()`, mengosongkan seluruh cache, dan mengembalikan timestamp pembersihan.

---

## 5. Integrasi Supabase Object Storage

File: `backend/src/services/adminMonitoring.service.js`

### 5.1 Kredensial & Autentikasi
Untuk membaca metadata seluruh berkas dalam bucket (bahkan bucket yang bersifat *private*), integrasi membutuhkan **Service Role Key**:
- `SUPABASE_URL`: `https://proomdjnrxdptdtbkvgv.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: Token rahasia dengan hak akses admin bypass RLS.
- Inisialisasi:
  ```javascript
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  ```

### 5.2 Auto-Provisioning Bucket (`gabah-files`)
Sistem dilengkapi kemampuan *self-healing*. Jika API Supabase mendeteksi belum ada bucket yang terdaftar, backend secara otomatis membuat bucket default:
```javascript
const { data: buckets, error: bError } = await supabase.storage.listBuckets();
if (!buckets || buckets.length === 0) {
  await supabase.storage.createBucket('gabah-files', {
    public: false,
    fileSizeLimit: 26214400 // 25 MB
  });
}
```

### 5.3 Recursive Folder Traversal & File Aggregation
Supabase Storage API bekerja secara hierarkis per folder. Service melakukan pembacaan recursive pada kategori standar aplikasi:
- Folder: `['struk', 'gabah', 'proses', 'hasil', 'retur']`
- Metadata yang diekstrak per objek:
  - `name`: Nama file unik
  - `id`: UUID objek
  - `metadata.size`: Ukuran file dalam bytes
  - `metadata.mimetype`: Tipe konten (image/jpeg, application/pdf, dll.)
  - `created_at`: Waktu upload

### 5.4 Graceful Fallback ke Database
Jika `SUPABASE_SERVICE_ROLE_KEY` belum terpasang di environment atau terjadi gangguan koneksi jaringan ke API Supabase, service tidak gagal (no 500 error), melainkan beralih ke mode **Estimasi Database**:
```javascript
return {
  source: 'database_estimate',
  warning: 'SUPABASE_SERVICE_ROLE_KEY not configured. Showing estimates from trx.files table.',
  ...dbFileStats
};
```

---

## 6. Integrasi Google Cloud Monitoring (Cloud Run Computing)

File: `backend/src/services/adminMonitoring.service.js`  
Dependency: `@google-cloud/monitoring`

### 6.1 Autentikasi GCP (Multi-Environment)
Backend mendukung 3 metode autentikasi transparan:
1. **Cloud Run Production / Staging (Workload Identity):**
   - Cloud Run otomatis menyuntikkan kredensial melalui metadata server GCP (`http://metadata.google.internal`).
2. **Local Development dengan ADC (Application Default Credentials):**
   - Service mendeteksi file ADC di Windows: `%APPDATA%\gcloud\application_default_credentials.json`
   - Jika file ini belum ada, service langsung mengembalikan status graceful tanpa melempar crash unhandled rejection:
     ```javascript
     {
       available: false,
       reason: "Kredensial GCP belum diatur di lingkungan lokal. Diperlukan 'gcloud auth application-default login'..."
     }
     ```
3. **Dedicated Service Account Key:**
   - Dikonfigurasi melalui path environment variable `GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json`.

### 6.2 Target Environment & Multi-Service Filter
Frontend menyediakan tombol switch untuk memilih service target:
- `gabah-api` (Layanan Cloud Run Production)
- `gabah-api-staging` (Layanan Cloud Run Staging)

Filter Time Series GCP dibangun secara dinamis tanpa mengunci region (mencegah filter mismatch antara `asia-southeast1` vs `asia-southeast2`):
```javascript
const filter = `metric.type = "${metricType}" AND resource.type = "cloud_run_revision" AND resource.labels.service_name = "${serviceName}"`;
```

### 6.3 Metrik yang Dipantau
| Indikator | Metric Descriptor GCP | Alignment / Reducer |
| :--- | :--- | :--- |
| **CPU Utilization** | `run.googleapis.com/container/cpu/utilizations` | `ALIGN_MEAN` per 60s |
| **Memory Utilization** | `run.googleapis.com/container/memory/utilizations` | `ALIGN_MEAN` per 60s |
| **Request Count** | `run.googleapis.com/request_count` | `ALIGN_RATE` atau `ALIGN_SUM` |
| **Request Latencies** | `run.googleapis.com/request_latencies` | `ALIGN_PERCENTILE_99` |
| **Container Instances** | `run.googleapis.com/container/instance_count` | `ALIGN_MAX` |

### 6.4 Penanganan Status Idle (*Scale to Zero*)
Cloud Run memiliki fitur *scale-to-zero* saat tidak ada request aktif. Pada kondisi ini:
- GCP Monitoring tidak menghasilkan data time series (array kosong).
- Backend secara cerdas mengenali kondisi ini dan mengembalikan payload:
  ```json
  {
    "status": "idle",
    "cpu": { "current_percent": 0 },
    "memory": { "current_percent": 0 },
    "instances": { "current": 0 },
    "notice": "Tidak ada data time series tersedia untuk rentang waktu ini. Kontainer Cloud Run sedang dalam status standby (0 instances aktif)."
  }
  ```
- Di Frontend, sistem menampilkan alert kotak biru informatif alih-alih pesan kegagalan merah.

---

## 7. Desain Frontend (React + TypeScript)

File: `FrontEnd-Giling/src/pages/admin/SystemMonitoring.tsx`  
Client API: `FrontEnd-Giling/src/api/client.ts` (`adminMonitoringAPI`)

### 7.1 Struktur State Management
- `activeTab`: `'overview' | 'users' | 'database' | 'storage' | 'computing'`
- `selectedUser`: User object untuk modal drilldown aktivitas.
- `gcpService`: `'gabah-api' | 'gabah-api-staging'`
- `gcpWindow`: `'30m' | '1h' | '3h' | '6h' | '24h'`
- `data`: Objek data per tab yang dimuat secara lazy (*on-demand*) saat tab dibuka.
- `refreshing`: Flag untuk animasi spinner dan deaktivasi tombol saat fetch berlangsung.

### 7.2 Sanitasi & Safe Number Rendering
Untuk mencegah error runtime `toFixed of undefined` jika metrik bernilai 0 atau belum ada:
```typescript
const formatSizeMB = (bytes: number | string | undefined | null) => {
  const num = Number(bytes);
  if (isNaN(num) || num <= 0) return '0.00 MB';
  return (num / (1024 * 1024)).toFixed(2) + ' MB';
};
```

---

## 8. Panduan Deployment & Checklist Konfigurasi Environment

### 8.1 Backend Environment Variables (`.env`)
Pastikan variabel berikut terkonfigurasi di Google Cloud Run / Container:

```env
# Koneksi Database Supabase
DATABASE_URL=postgresql://postgres.proomdjnrxdptdtbkvgv:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres

# Supabase Storage Integration
SUPABASE_URL=https://proomdjnrxdptdtbkvgv.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJh... (Service Role Key dari API Settings)

# Google Cloud Platform Monitoring
GCP_PROJECT_ID=padinadipilot2026
# Opsional jika dijalankan di luar GCP (lokal/VPS):
# GOOGLE_APPLICATION_CREDENTIALS=/secrets/gcp-sa-key.json
```

### 8.2 Izin IAM Google Cloud (*Cloud Run Service Account*)
Service account yang menjalankan Cloud Run backend (`gabah-api`) harus memiliki role minimal berikut di IAM GCP:
- **Monitoring Viewer (`roles/monitoring.viewer`)**: Izin untuk membaca time series metrik Cloud Run.

### 8.3 Cara Menjadikan User Sebagai Super Admin
Jalankan query berikut di Supabase SQL Editor atau migrasi untuk mengangkat akun developer/owner menjadi Super Admin:
```sql
UPDATE sys.users 
SET is_super_admin = true 
WHERE username = 'developer' OR email = 'owner@example.com';
```
Setelah query dijalankan, user harus **Logout dan Login kembali** agar token JWT diperbarui dengan klaim `is_super_admin: true`.
