# 📘 Panduan Lengkap Staging Environment & Multi-Environment CI/CD (Backend)

Dokumen ini mendokumentasikan seluruh konfigurasi, arsitektur, dan alur kerja otomatisasi **Staging Environment** serta **Multi-Environment CI/CD** untuk backend `BackEnd-Giling`.

---

## 🏛️ 1. Arsitektur Multi-Environment

Backend berjalan di Google Cloud Run dengan isolasi penuh antara Production dan Staging:

| Komponen | 🧪 Staging Environment | 🏭 Production Environment |
|---|---|---|
| **Branch Git** | `AkmalDeploy` | `main` |
| **Cloud Run Service** | `gabah-api-staging` | `gabah-api` |
| **Port Container** | `3000` | `3000` |
| **Database** | Supabase Staging (`gabah-staging-db`) | Supabase Primary Database |
| **Service URL** | `https://gabah-api-staging-615541393276.asia-southeast1.run.app` | `https://gabah-api-615541393276.asia-southeast1.run.app` |
| **Health Check** | `/health` | `/health` |

---

## 🔐 2. Konfigurasi Secret Manager di GCP

Seluruh environment variable sensitif disuntikkan secara dinamis dari **GCP Secret Manager** berdasarkan target branch:

### A. Secrets untuk Staging (`AkmalDeploy`)
* `DATABASE_URL_STAGING`: Connection string pooler Supabase Staging (Port 6543).
* `LOG_DATABASE_URL_STAGING`: Audit log connection string Supabase Staging.
* `JWT_SECRET_STAGING`: Secret key enkripsi token auth untuk staging.
* `CORS_ORIGIN_STAGING`: Whitelist domain Frontend Staging (`https://gabah-frontend-staging-615541393276.asia-southeast1.run.app,http://localhost:5173`).

### B. Secrets untuk Production (`main`)
* `DATABASE_URL`: Connection string pooler Supabase Production.
* `LOG_DATABASE_URL`: Audit log connection string Supabase Production.
* `JWT_SECRET`: Secret key enkripsi token auth Production.
* `CORS_ORIGIN`: Whitelist domain Frontend Production (`https://gabah-frontend-615541393276.asia-southeast1.run.app`).

> ⚠️ **Catatan Format Supabase Pooler**:
> Username koneksi pooler wajib menyertakan Project Ref ID:
> `postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`
> Jika tanpa `.[PROJECT_REF]`, pooler akan gagal dengan error `(ENOIDENTIFIER) no tenant identifier provided`.

---

## 🔄 3. Alur Otomatisasi CI/CD (`.github/workflows/deploy.yml`)

Workflow GitHub Actions mendeteksi branch secara dinamis menggunakan step `env-target`:

```yaml
- name: Set Environment Target
  id: env-target
  run: |
    if [ "${{ github.ref_name }}" = "main" ]; then
      echo "ENV_NAME=production" >> $GITHUB_OUTPUT
      echo "SERVICE_NAME=gabah-api" >> $GITHUB_OUTPUT
      echo "IMAGE_TAG=latest" >> $GITHUB_OUTPUT
      echo "SECRETS=DATABASE_URL=DATABASE_URL:latest,LOG_DATABASE_URL=LOG_DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest,CORS_ORIGIN=CORS_ORIGIN:latest" >> $GITHUB_OUTPUT
    else
      echo "ENV_NAME=staging" >> $GITHUB_OUTPUT
      echo "SERVICE_NAME=gabah-api-staging" >> $GITHUB_OUTPUT
      echo "IMAGE_TAG=staging" >> $GITHUB_OUTPUT
      echo "SECRETS=DATABASE_URL=DATABASE_URL_STAGING:latest,LOG_DATABASE_URL=LOG_DATABASE_URL_STAGING:latest,JWT_SECRET=JWT_SECRET_STAGING:latest,CORS_ORIGIN=CORS_ORIGIN_STAGING:latest" >> $GITHUB_OUTPUT
    fi
```

### Mekanisme Kerja:
1. **Push ke `AkmalDeploy`**:
   * Membangun image tag `:staging` dan tag commit SHA unik.
   * Melakukan deploy otomatis ke service Cloud Run **`gabah-api-staging`**.
   * Menginjeksi secret database `DATABASE_URL_STAGING`.
2. **Push ke `main`**:
   * Membangun image tag `:latest` dan tag commit SHA unik.
   * Melakukan deploy otomatis ke service Cloud Run **`gabah-api`** (Production).
   * Menginjeksi secret database `DATABASE_URL` (Production).

---

## 🛠️ 4. Migrasi & Seeding Database Staging Baru

Jika membuat database staging baru dari awal, jalankan perintah berikut dari lokal:

```powershell
cd backend
$env:DATABASE_URL = "postgresql://postgres.[STAGING_REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres"

# 1. Jalankan 80+ file SQL migration
npm run migrate

# 2. Masukkan akun admin awal & sample batch
npm run seed
```

Kredensial Login Default:
* **Username**: `admin`
* **Password**: `admin123`
