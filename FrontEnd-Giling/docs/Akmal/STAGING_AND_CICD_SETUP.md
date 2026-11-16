# 🎨 Panduan Lengkap Staging Environment & Multi-Environment CI/CD (Frontend)

Dokumen ini mendokumentasikan seluruh konfigurasi, arsitektur, dan alur kerja otomatisasi **Staging Environment** serta **Multi-Environment CI/CD** untuk frontend `FrontEnd-Giling`.

---

## 🏛️ 1. Arsitektur Multi-Environment

Frontend berjalan di Google Cloud Run (Nginx Alpine container) dengan isolasi penuh antara Production dan Staging:

| Komponen | 🧪 Staging Environment | 🏭 Production Environment |
|---|---|---|
| **Branch Git** | `AkmalDeploy` | `main` |
| **Cloud Run Service** | `gabah-frontend-staging` | `gabah-frontend` |
| **Nginx Config** | `nginx.staging.conf` | `nginx.conf` |
| **Backend Target** | `https://gabah-api-staging-615541393276.asia-southeast1.run.app` | `https://gabah-api-615541393276.asia-southeast1.run.app` |
| **Service URL** | `https://gabah-frontend-staging-615541393276.asia-southeast1.run.app` | `https://gabah-frontend-615541393276.asia-southeast1.run.app` |

---

## 🌐 2. Konfigurasi Nginx Multi-Target

Untuk memisahkan target API backend antara Staging dan Production tanpa mengubah source code React, kita menggunakan 2 file konfigurasi Nginx:

### A. `nginx.staging.conf` (Untuk Staging)
Meneruskan seluruh request `/api/` dan `/health` ke Backend Staging:
```nginx
location /api/ {
    proxy_pass https://gabah-api-staging-615541393276.asia-southeast1.run.app;
    proxy_http_version 1.1;
    proxy_set_header Host gabah-api-staging-615541393276.asia-southeast1.run.app;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_ssl_server_name on;
}
```

### B. `nginx.conf` (Untuk Production)
Meneruskan seluruh request `/api/` dan `/health` ke Backend Production:
```nginx
location /api/ {
    proxy_pass https://gabah-api-615541393276.asia-southeast1.run.app;
    proxy_http_version 1.1;
    proxy_set_header Host gabah-api-615541393276.asia-southeast1.run.app;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_ssl_server_name on;
}
```

---

## 🐳 3. Dockerfile Multi-Stage dengan Build ARG

File `Dockerfile` dirancang dinamis dengan argumen `NGINX_CONF`:

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Stage 2: Serve with NGINX ---
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html

# ARG dinamis untuk memilih file nginx
ARG NGINX_CONF=nginx.conf
COPY ${NGINX_CONF} /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## 🔄 4. Alur Otomatisasi CI/CD (`.github/workflows/deploy.yml`)

Workflow GitHub Actions secara otomatis memilih target service dan file nginx berdasarkan branch:

```yaml
- name: Set Environment Target
  id: env-target
  run: |
    if [ "${{ github.ref_name }}" = "main" ]; then
      echo "ENV_NAME=production" >> $GITHUB_OUTPUT
      echo "SERVICE_NAME=gabah-frontend" >> $GITHUB_OUTPUT
      echo "IMAGE_TAG=latest" >> $GITHUB_OUTPUT
      echo "NGINX_CONF=nginx.conf" >> $GITHUB_OUTPUT
    else
      echo "ENV_NAME=staging" >> $GITHUB_OUTPUT
      echo "SERVICE_NAME=gabah-frontend-staging" >> $GITHUB_OUTPUT
      echo "IMAGE_TAG=staging" >> $GITHUB_OUTPUT
      echo "NGINX_CONF=nginx.staging.conf" >> $GITHUB_OUTPUT
    fi
```

### Mekanisme Build & Deploy:
1. **Push ke `AkmalDeploy`**:
   * Menjalankan build Docker dengan `--build-arg NGINX_CONF=nginx.staging.conf`.
   * Melakukan push image dengan tag `:staging` dan tag commit SHA unik.
   * Melakukan deploy otomatis ke Cloud Run service **`gabah-frontend-staging`**.
2. **Push ke `main`**:
   * Menjalankan build Docker dengan `--build-arg NGINX_CONF=nginx.conf`.
   * Melakukan push image dengan tag `:latest` dan tag commit SHA unik.
   * Melakukan deploy otomatis ke Cloud Run service **`gabah-frontend`** (Production).

---

## 🧪 5. Verifikasi & Uji Coba

1. Buka URL Staging di browser:
   👉 `https://gabah-frontend-staging-615541393276.asia-southeast1.run.app`
2. Buka DevTools (**F12 ➔ Network**):
   * Pastikan seluruh request API diarahkan ke `/api/...` dan mengembalikan respon sukses dari database Staging.
   * Pastikan tidak ada CORS error.
