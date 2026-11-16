# Backend API — Belanja Giling

REST API server untuk sistem manajemen penggilingan padi.

> **Untuk panduan menjalankan sistem lengkap**, lihat [`README.md` di root `/src`](../README.md).
> **Untuk panduan teknis developer**, lihat [`DEVELOPER_HANDOVER.md`](../DEVELOPER_HANDOVER.md).

---

## Cara Menjalankan (Manual / Tanpa Docker)

```bash
# 1. Install dependencies
npm install

# 2. Pastikan file .env sudah ada di folder BackEnd-Giling/
#    (lihat .env.example di root /src sebagai template)

# 3. Jalankan semua migrasi database
npm run migrate

# 4. (Opsional) Isi data seed awal
npm run seed

# 5. Jalankan server
npm run dev
```

Server berjalan di `http://localhost:3000`

---

## Struktur API Endpoint Utama

| Method | Path | Deskripsi |
|---|---|---|
| `POST` | `/api/auth/login` | Login, dapat JWT |
| `GET` | `/api/batches` | Daftar batch pembelian |
| `GET` | `/api/batches/:id` | Detail batch |
| `GET` | `/api/inventory` | Daftar stok gudang |
| `POST` | `/api/inventory/from-batch/:batchId` | Transfer gabah dari batch ke gudang |
| `POST` | `/api/inventory/from-drying/:dryingId` | Transfer gabah dari drying ke gudang |
| `POST` | `/api/inventory/:id/take-weight` | Ambil stok berdasarkan berat |
| `POST` | `/api/inventory/:id/take` | Ambil stok berdasarkan karung (BERAS) |
| `GET` | `/api/processes` | Daftar proses giling |
| `POST` | `/api/processes/:id/complete` | Selesaikan giling + hitung HPP & Rendemen |
| `GET` | `/api/drying` | Daftar proses pengeringan |

---

## Scripts

```bash
npm run dev       # Jalankan dengan nodemon (hot-reload)
npm start         # Jalankan tanpa nodemon (production)
npm run migrate   # Jalankan semua migrasi SQL
npm run seed      # Isi data awal (admin user, master data)
```

---

## Database Migrations

File migrasi tersimpan di `migrations/` dan berjalan **berurutan** (001 → 043).

> ⚠️ **Jangan edit file migrasi yang sudah ada.** Jika perlu mengubah skema, buat file migrasi baru dengan nomor urut berikutnya.
