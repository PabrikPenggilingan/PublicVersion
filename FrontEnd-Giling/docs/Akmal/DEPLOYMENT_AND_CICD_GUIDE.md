# 🎨 Panduan Arsitektur, Deployment GCP Cloud Run, & CI/CD Frontend

Dokumen ini disusun sebagai panduan bagi developer berikutnya mengenai cara kerja build frontend React, konfigurasi Nginx reverse proxy, deployment ke Google Cloud Run, dan alur CI/CD otomatis via GitHub Actions.

---

## 🏗️ 1. Arsitektur Frontend

* **Framework**: React 18 + TypeScript + Vite.
* **Styling**: Tailwind CSS + Lucide Icons.
* **Server**: Nginx Alpine (`nginx:alpine`) sebagai web server statis dan reverse proxy API.
* **Hosting Platform**: Google Cloud Run (Port `80`).
* **Container Registry**: GCP Artifact Registry (`asia-southeast1-docker.pkg.dev/padinadipilot2026/padinadipilot/gabah-frontend`).
* **Live Service URL**: `https://gabah-frontend-615541393276.asia-southeast1.run.app`

---

## 🌐 2. Konfigurasi Nginx Reverse Proxy (`nginx.conf`)

Di Cloud Run, container frontend menjalankan Nginx untuk melayani bundle React sekaligus meneruskan request `/api/` langsung ke Backend Cloud Run via HTTPS tanpa CORS issue:

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript;

    # Proxy API ke Backend Cloud Run
    location /api/ {
        proxy_pass https://gabah-api-615541393276.asia-southeast1.run.app;
        proxy_http_version 1.1;
        proxy_set_header Host gabah-api-615541393276.asia-southeast1.run.app;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_ssl_server_name on;
    }

    # Proxy Health check
    location /health {
        proxy_pass https://gabah-api-615541393276.asia-southeast1.run.app/health;
        proxy_http_version 1.1;
        proxy_set_header Host gabah-api-615541393276.asia-southeast1.run.app;
        proxy_ssl_server_name on;
    }

    # SPA Fallback (React Router)
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 🔄 3. Alur Kerja CI/CD Otomatis (GitHub Actions)

File workflow CI/CD terletak di:
👉 `.github/workflows/deploy.yml`

### A. Trigger Deployment & Branch Strategy
Workflow akan otomatis berjalan saat ada `git push` ke branch:
* `AkmalDeploy` (Branch testing & deployment saat ini)
* `main` (Branch utama produksi)

#### ❓ Branch Mana yang Ditampilkan di Cloud Run Saat Ini?
> **Prinsip: "Last Push Wins" (Revisi Terakhir Mengambil 100% Traffic)**
> 
> Cloud Run menggunakan sistem revisi. Setiap kali ada commit baru yang di-push ke salah satu branch terdaftar di atas:
> 1. GitHub Actions akan mem-build bundle React dari branch tersebut.
> 2. Cloud Run akan membuat **Revision Baru** dan mengalihkan **100% traffic** ke revisi terbaru tersebut.
> 3. Oleh karena itu, tampilan web frontend yang live di URL saat ini adalah **kode dari branch yang paling terakhir Anda push (yaitu `AkmalDeploy`)**.

#### 🏢 Rekomendasi Pemisahan Multi-Environment ke Depan (Staging vs Production)
Jika nantinya tim ingin memiliki 2 URL frontend aktif secara bersamaan tanpa saling menimpa:
* **Staging Frontend** (`https://staging-gabah-frontend-xxx.a.run.app`): Otomatis deploy saat push ke branch `staging` / `AkmalDeploy`.
* **Production Frontend** (`https://gabah-frontend-xxx.a.run.app`): Otomatis deploy hanya saat Pull Request di-merge ke branch `main`.
* Hal ini dapat diatur dengan membuat 2 service Cloud Run berbeda pada file `deploy.yml`.

### B. Tahapan Eksekusi Otomatis:
1. **Checkout Code**: Menarik source code terbaru.
2. **Authenticate to Google Cloud**: Login ke GCP menggunakan Secret `GCP_SA_KEY`.
3. **Configure Docker**: Mengatur otentikasi Docker ke `asia-southeast1-docker.pkg.dev`.
4. **Build & Push Docker Image**:
   * Melakukan kompilasi `tsc && vite build` di dalam container multi-stage build.
   * Menghasilkan bundle statis di `/usr/share/nginx/html`.
   * Melakukan push image dengan tag commit SHA unik dan `:latest`.
5. **Deploy to Cloud Run**: Memperbarui service `gabah-frontend` di Cloud Run pada port `80`.

---

## 🔑 4. Konfigurasi Repository Secrets di GitHub

Di repository GitHub **`FrontEnd-Giling` ➔ Settings ➔ Secrets and variables ➔ Actions (Repository secrets)**, pastikan variabel berikut terdaftar:

* **`GCP_PROJECT_ID`**: `padinadipilot2026`
* **`GCP_SA_KEY`**: Seluruh isi teks JSON Service Account `github-actions-deployer`.

---

## 🛠️ 5. Perintah Manual / Troubleshooting Cepat

Jika sewaktu-waktu perlu melakukan build atau deploy manual dari terminal:

```powershell
# 1. Masuk folder frontend
cd FrontEnd-Giling

# 2. Build & Push Image
docker build -t asia-southeast1-docker.pkg.dev/padinadipilot2026/padinadipilot/gabah-frontend:latest .
docker push asia-southeast1-docker.pkg.dev/padinadipilot2026/padinadipilot/gabah-frontend:latest

# 3. Deploy ke Cloud Run
gcloud run deploy gabah-frontend `
  --image=asia-southeast1-docker.pkg.dev/padinadipilot2026/padinadipilot/gabah-frontend:latest `
  --region=asia-southeast1 `
  --platform=managed `
  --allow-unauthenticated `
  --port=80 `
  --memory=256Mi `
  --cpu=1
```
