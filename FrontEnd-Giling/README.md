# FrontEnd-Giling (UI Dashboard)

Proyek ini adalah antarmuka pengguna (Frontend) untuk **Sistem Manajemen Penggilingan Padi**. Aplikasi ini dibangun untuk memudahkan pengelola penggilingan melacak proses pembelian, stok gudang (Inventory), produksi giling, dan perhitungan finansial dengan pengalaman pengguna yang modern.

## 🚀 Tech Stack

- **React.js 18** (UI Framework)
- **TypeScript** (Static Typing)
- **Vite** (Build Tool yang super cepat)
- **Tailwind CSS** (Styling Modern dengan Tema Gelap/Dark Mode)
- **Lucide React** (Ikonografi UI)

> 📄 For Docker architecture details, see [ABOUT_DOCKERIZE.md](./ABOUT_DOCKERIZE.md).
>
> 📚 Perubahan terbaru (15 Nov 2026): [docs/Akmal/DOKUMENTASI_PERUBAHAN_2026_11_15.md](./docs/Akmal/DOKUMENTASI_PERUBAHAN_2026_11_15.md)

---

## 🐳 Cara Termudah: Docker Compose (Recommended)

Cara termudah untuk menjalankan seluruh aplikasi (Frontend + Backend + Database) adalah dengan Docker Compose dari folder `BackEnd-Giling`. Semua sudah terkonfigurasi secara otomatis.

```bash
# Pastikan kedua repo di-clone sebagai sibling:
# AERP/BackEnd-Giling/   ◄── jalankan dari sini
# AERP/FrontEnd-Giling/  ◄── di-build otomatis oleh Docker

cd BackEnd-Giling/
cp .env.example .env
docker-compose up -d --build
docker-compose exec api npm run seed

# Akses di: http://localhost
```

---

## 💻 Local Development (Tanpa Docker)

> **Catatan Penting:** Pastikan Server **Backend** (`BackEnd-Giling`) sudah berjalan terlebih dahulu. Silakan merujuk pada [../BackEnd-Giling/README.md](../BackEnd-Giling/README.md) untuk panduan instalasi backend.

Jika Backend sudah berjalan di `http://localhost:3000`, ikuti langkah berikut:

### 1. Prasyarat
- Node.js (Minimal v18) sudah terinstal.

### 2. Instalasi Dependensi
```bash
npm install
```

### 3. Menjalankan Server Development
```bash
npm run dev
```

### 4. Akses Dashboard
Buka browser dan kunjungi `http://localhost:5173`.

Gunakan kredensial default (*jika database telah diseed*):
- **Username:** admin
- **Password:** admin123

---

## 📂 Struktur Folder
*   `src/api/` - Konfigurasi dan *Client wrapper* untuk komunikasi dengan API Backend.
*   `src/components/` - Kumpulan komponen UI yang dapat digunakan berulang (misal: Sidebar, Modal).
*   `src/pages/` - Halaman utama aplikasi, mencakup `Dashboard`, `Inventory`, `Milling (Process)`, dll.
*   `src/utils/` - Fungsi-fungsi bantuan (pembulatan angka, formatting uang, dll).

## 📝 Available Scripts
- `npm run dev` : Menjalankan server development dengan *hot reload*.
- `npm run build`: Mem-build aplikasi ke mode *production* (menghasilkan folder `dist/`).
- `npm run preview`: Melihat *preview* aplikasi setelah proses build.

- `npm run preview`: Melihat *preview* aplikasi setelah proses build.