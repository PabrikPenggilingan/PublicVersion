# 📘 Panduan Arsitektur, Deployment GCP Cloud Run, & CI/CD Backend

Dokumen ini disusun sebagai panduan komprehensif bagi developer berikutnya mengenai cara kerja arsitektur backend, containerization, integrasi database Supabase, deployment GCP Cloud Run, dan alur kerja CI/CD otomatis via GitHub Actions.

---

## 🏗️ 1. Arsitektur Sistem Backend

* **Framework**: Node.js v18+ dengan Express.js.
* **Database**: PostgreSQL di-host di Supabase Cloud (dengan connection pooler di port `6543`).
* **Containerization**: Docker berbasis image `node:18-alpine`.
* **Hosting Platform**: Google Cloud Run (Serverless Container).
* **Container Registry**: GCP Artifact Registry (`asia-southeast1-docker.pkg.dev/padinadipilot2026/padinadipilot/gabah-api`).

---

## 🔐 2. Manajemen Environment Variables & Secrets

Di lingkungan lokal, backend membaca file `.env`. Namun, pada **GCP Cloud Run**, seluruh kredensial sensitif dikelola melalui **GCP Secret Manager**:

| Nama Secret | Deskripsi | Contoh / Nilai |
|---|---|---|
| `DATABASE_URL` | Supabase Transactional Pooler URL | `postgresql://postgres.xxx:...@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres` |
| `LOG_DATABASE_URL` | Supabase Audit Log Database URL | `postgresql://postgres.xxx:...@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres` |
| `JWT_SECRET` | Secret key untuk enkripsi token auth | String acak unik untuk staging/production |
| `CORS_ORIGIN` | Whitelist domain frontend yang diizinkan | `https://gabah-frontend-615541393276.asia-southeast1.run.app,http://localhost:5173` |

> ⚠️ **Catatan Penting**: Saat membuat secret, pastikan tidak ada tanda petik ganda (`"`) atau spasi liar agar connection string PostgreSQL terbaca valid oleh driver `pg`.

---

## 🔄 3. Alur Kerja CI/CD Otomatis (GitHub Actions)

File workflow CI/CD terletak di:
👉 `.github/workflows/deploy.yml`

### A. Trigger Deployment & Branch Strategy
Workflow akan otomatis berjalan setiap kali ada `git push` ke branch:
* `AkmalDeploy` (Branch testing & deployment saat ini)
* `main` (Branch utama produksi)

#### ❓ Branch Mana yang Ditampilkan di Cloud Run Saat Ini?
> **Prinsip: "Last Push Wins" (Revisi Terakhir Mengambil 100% Traffic)**
> 
> Cloud Run menggunakan sistem revisi. Setiap kali ada commit baru yang di-push ke salah satu branch terdaftar di atas:
> 1. GitHub Actions akan mem-build kode dari branch tersebut.
> 2. Cloud Run akan membuat **Revision Baru** dan mengalihkan **100% traffic** ke revisi terbaru tersebut.
> 3. Oleh karena itu, versi yang live di server saat ini adalah **kode dari branch yang paling terakhir Anda push (yaitu `AkmalDeploy`)**.

#### 🏢 Rekomendasi Pemisahan Multi-Environment ke Depan (Staging vs Production)
Jika nantinya tim ingin memiliki 2 URL aktif secara bersamaan tanpa saling menimpa:
* **Staging Server** (`https://staging-api-xxx.a.run.app`): Otomatis deploy saat push ke branch `staging` / `AkmalDeploy`.
* **Production Server** (`https://api-xxx.a.run.app`): Otomatis deploy hanya saat Pull Request di-merge ke branch `main`.
* Hal ini dapat diatur dengan membuat 2 service Cloud Run berbeda pada file `deploy.yml`.

### B. Tahapan Eksekusi Robot GitHub Actions:
1. **Checkout Code**: Mengunduh kode sumber terbaru dari repository.
2. **Authenticate to Google Cloud**: Login ke GCP menggunakan Service Account JSON (`GCP_SA_KEY`).
3. **Configure Docker**: Menghubungkan Docker runner ke GCP Artifact Registry (`asia-southeast1`).
4. **Build & Push Docker Image**: Membangun image dari folder `/backend` dengan tag commit SHA unik dan `:latest`.
5. **Deploy to Cloud Run**: Memperbarui revisi Cloud Run service `gabah-api` di port `3000` dengan menginjeksi secrets secara otomatis.

---

## 🔑 4. Konfigurasi Repository Secrets di GitHub

Bagi developer berikutnya yang melakukan setup repository baru / fork, pastikan mendaftarkan secret berikut di:
**GitHub Repository ➔ Settings ➔ Secrets and variables ➔ Actions (Repository secrets)**:

* **`GCP_PROJECT_ID`**: `padinadipilot2026`
* **`GCP_SA_KEY`**: Isi seluruh teks file JSON dari Service Account `github-actions-deployer`.

---

## 🛠️ 5. Perintah Manual / Troubleshooting Cepat

Jika sewaktu-waktu perlu melakukan build atau deploy manual dari terminal:

```powershell
# 1. Masuk folder backend
cd backend

# 2. Build & Push Image
docker build -t asia-southeast1-docker.pkg.dev/padinadipilot2026/padinadipilot/gabah-api:latest .
docker push asia-southeast1-docker.pkg.dev/padinadipilot2026/padinadipilot/gabah-api:latest

# 3. Deploy ke Cloud Run
gcloud run deploy gabah-api `
  --image=asia-southeast1-docker.pkg.dev/padinadipilot2026/padinadipilot/gabah-api:latest `
  --region=asia-southeast1 `
  --platform=managed `
  --allow-unauthenticated `
  --port=3000 `
  --memory=512Mi `
  --cpu=1 `
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,LOG_DATABASE_URL=LOG_DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest,CORS_ORIGIN=CORS_ORIGIN:latest"
```

* **Healthcheck Endpoint**: `https://gabah-api-615541393276.asia-southeast1.run.app/health`
