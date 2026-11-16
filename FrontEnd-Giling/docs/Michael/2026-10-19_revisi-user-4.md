# 🌾 Dokumentasi Revisi User 4 (19 Okt 2026)

## 1. Overview
Dokumentasi ini mencatat perubahan dan perbaikan yang dilakukan pada branch `fix/user-4` di modul frontend (**FrontEnd-Giling**). Fokus utama pada tahap ini adalah penyesuaian UX/UI serta fleksibilitas input pada modul Pengeringan (**Drying**), mencakup:
1. Alur pembuatan proses pengeringan baru di `DryingList.tsx`.
2. Alur pemindahan gabah kering ke gudang/inventory di `DryingDetail.tsx`.

---

## 2. Rincian Pekerjaan

### A. Penelusuran Alur Tombol "+ Pengeringan Baru"
Dilakukan audit kode untuk memetakan alur tombol `+ Pengeringan Baru` pada `DryingList.tsx`:
1. **Trigger UI**: Tombol di header (`DryingList.tsx:L222-232`) dan empty state (`L373-383`) memicu state `setShowCreateModal(true)` dan fungsi `loadAvailableBatches()`.
2. **Data Gabah**: Mengambil daftar batch reguler via `batchesAPI.getAll({ availableForDrying: 'true' })` dan gabah titipan basah via `inventoryAPI.getAvailableTitipanBasah()`.
3. **Eksekusi API**: Pada submit modal (`handleCreate`), memanggil `dryingAPI.create(payload)` (`POST /api/drying`).
4. **Navigasi**: Setelah sukses dibuat, aplikasi melakukan redirect langsung ke halaman detail `/drying/:id` (`DryingDetail.tsx`).

---

### B. Penyesuaian Nama Pengeringan (`DryingList.tsx`)
Sesuai feedback pengguna, field *Nama Pengeringan* pada modal "Buat Proses Pengeringan Baru" dijadikan opsional dengan nilai default:
1. **Menghapus Tanda Bintang Merah (`*`)**:
   - Indikator required `<span className="text-red-400">*</span>` dihapus dari label *Nama Pengeringan*.
   - Digantikan dengan teks indikator opsional `<span className="text-stone-500">(opsional)</span>`.
2. **Placeholder Informatif**:
   - Placeholder input diperbarui menjadi `Default: Pengeringan Gabah`.
3. **Peniadaan Validasi Wajib di Frontend**:
   - Blok validasi `if (!newName.trim()) { toast.error('Nama pengeringan harus diisi'); return; }` pada fungsi `handleCreate` dihapus.
4. **Nilai Default Otomatis**:
   - Jika pengguna tidak mengisi nama, sistem otomatis menetapkan nilai default `'Pengeringan Gabah'` pada payload API:
     ```ts
     name: newName.trim() || 'Pengeringan Gabah'
     ```
   - Skema backend Joi pada `drying.validator.js` telah mendukung `name: Joi.string().optional().allow('', null)`.

---

### C. Penyesuaian Lokasi/Area & Tanda Identifikasi ("Pindahkan ke Inventory")
Sesuai feedback pengguna, konfigurasi pada modal "Pindahkan ke Inventory" di `DryingDetail.tsx` disesuaikan:
1. **Tanda Identifikasi (Wajib Diisi)**:
   - Dikembalikan statusnya menjadi **wajib diisi** dengan indikator bintang merah: `<label>Tanda Identifikasi <span className="text-red-400">*</span></label>`.
   - Placeholder input: `placeholder="Contoh: Karung Merah"`.
   - Jika pengguna belum mengisi field ini saat menekan tombol "Proses", sistem memunculkan **notification window** modal (menggunakan template `confirmDialog` ber-variant `warning` dengan tombol tunggal "Mengerti"):
     ```ts
     if (!inventoryData.tanda?.trim()) {
         await confirmDialog('Tanda Identifikasi wajib diisi sebelum memindahkan gabah kering ke gudang.', {
             title: 'Tanda Identifikasi Diperlukan',
             variant: 'warning',
             confirmText: 'Mengerti',
             hideCancel: true
         })
         return
     }
     ```
2. **Lokasi/Area (Tetap Opsional)**:
   - Label: `<label>Lokasi/Area <span className="text-stone-500 font-normal">(opsional)</span></label>`.
   - Placeholder: `Default: Gudang`.
   - Jika tidak diisi, otomatis menggunakan fallback default: `inventoryData.area?.trim() || 'Gudang'`.
3. **Peningkatan Template Dialog (`src/utils/confirmDialog.tsx`)**:
   - Ditambahkan opsi `hideCancel?: boolean` pada `ConfirmOptions` agar modal dapat berfungsi sebagai dialog notifikasi/peringatan (alert) dengan satu tombol aksi utama.
   - Diekspor juga helper function `alertDialog(...)` untuk kemudahan penggunaan di modul lain.

```tsx
// Tampilan Form Modal Pindahkan ke Inventory:
<label>Lokasi/Area <span className="text-stone-500 font-normal">(opsional)</span></label>
<input placeholder="Default: Gudang" ... />

<label>Tanda Identifikasi <span className="text-red-400">*</span></label>
<input placeholder="Contoh: Karung Merah" ... />
```

### D. Penambahan Tanggal Batch pada Modal Pemilihan Gabah Giling (`Processes.tsx`)
1. **Penambahan Tanggal Setelah Tonase**:
   - Pada modal *"Pilih Gabah untuk Digiling"* dan trigger button pemilihan gabah di `Processes.tsx`, ditambahkan informasi tanggal batch setelah teks tonase/sisa berat:
     `{Number(item.remaining_weight_kg).toLocaleString()} kg tersisa ... · {formatDateShort(item.batch_date || item.entry_date || item.created_at)}`.
   - Berlaku untuk kategori **Gabah Pribadi** maupun **Gabah Titipan (Sudah Kering)**.
2. **Asal-usul `batch_date`**:
   - Kolom `batch_date` berasal dari **tanggal saat batch dibuat/dibeli pada modul Belanja Gabah** (`trx.batches.batch_date`), **bukan** tanggal pengeringan.
### E. Kondisi Khusus Biaya Packaging/Karung (`ProcessDetail.tsx`)
Pada modal *"Tambah Biaya Produksi"*, ditambahkan perilaku kondisional saat opsi **Packaging/Karung** (`costType === 'PACKAGING'`) dipilih:
1. **Perubahan Tampilan Input Nominal**:
   - Input tunggal *Nominal (IDR)* digantikan dengan tata letak 3 field:
     - **Baris 1 (Grid 2 Kolom)**:
       - **Jumlah Karung** (width 50%, dapat diisi user, wajib).
       - **Biaya / Karung** (width 50%, dapat diisi user, wajib, berawalan `Rp`).
     - **Baris 2 (Full Width)**:
       - **Total Biaya** (width 100%, diletakkan di bawah, dihitung otomatis: `Jumlah Karung × Biaya / Karung`, `readOnly`/tidak dapat diubah langsung oleh user).
2. **Kalkulasi Otomatis & Payload**:
   - `amount` pada `newCost` otomatis terisi dari perkalian kedua field tersebut.
   - Keterangan default mencatat detail perhitungan (misal: `100 karung @ Rp 2.500`) jika user tidak mengisi keterangan kustom.
3. **Validasi Khusus**:
   - Divalidasi agar Jumlah Karung dan Biaya per Karung harus lebih dari 0 sebelum menyimpan biaya.
4. **Otomatisasi Pengisian Jumlah Karung (Auto-fill on Trigger)**:
   - Ketika user memilih tipe biaya **Packaging/Karung**, sistem secara cerdas mengecek ketersediaan data laporan akhir:
     - **Sumber 1 (Sebelum Finalisasi)**: Membaca sesi `END` pada `millingSummary.sessions` dari laporan akhir operator lapangan, mem-parse `output_data` dan menjumlahkan seluruh karung (`sacks`) untuk kategori `BERAS`.
     - **Sumber 2 (Setelah Finalisasi)**: Jika proses telah selesai (`COMPLETED`), membaca data `total_sacks` dari seluruh item beras di `inventoryItems`.
   - Angka total karung tersebut langsung diisikan otomatis ke input **Jumlah Karung**, disertai indikator visual konfirmasi (`✓ Diisi otomatis dari laporan akhir (X karung beras)`).
   - Terdapat juga tombol bantuan untuk mengembalikan angka ke data laporan jika user sempat mengubahnya.
   - User tetap memiliki fleksibilitas untuk mengubah jumlah karung secara manual jika diperlukan.
5. **Penyempurnaan Tampilan Kemasan pada Tabel Hasil Produksi**:
   - Kolom *Kemasan* pada tabel *Hasil Produksi Beras & Turunan* diperbarui agar jika item memiliki ukuran kemasan (misal `25 kg`), juga menampilkan jumlah karung berdampingan dalam tanda kurung: `25 kg (50 karung)`.

---

## 3. Berkas yang Diubah

| Berkas | Jenis Perubahan | Deskripsi Singkat |
| :--- | :--- | :--- |
| `src/pages/DryingList.tsx` | UI & Logika Form | Menjadikan `name` opsional, fallback default `'Pengeringan Gabah'`, menghapus red asterisk, dan update placeholder. |
| `src/pages/DryingDetail.tsx` | UI & Logika Form | Mewajibkan kembali `tanda` dengan red asterisk dan notifikasi dialog modal jika kosong, serta menjadikan `area` opsional dengan default `'Gudang'`. |
| `src/utils/confirmDialog.tsx` | Fitur UI Utility | Menambahkan opsi `hideCancel` dan helper `alertDialog` untuk menampilkan notification window peringatan tanpa tombol Batal. |
| `src/pages/Processes.tsx` | UI Gabah Picker | Menambahkan tanggal batch setelah informasi tonase pada modal pemilihan gabah giling. |
| `src/pages/ProcessDetail.tsx` | UI & Logika Form | Menambahkan layout 3 field berkalkulasi otomatis ketika tipe biaya Packaging/Karung dipilih, auto-fill jumlah karung dari hasil giling beras terfinalisasi, dan menampilkan jumlah karung di tabel hasil produksi. |

---

## 4. Hasil Pengujian & Verifikasi
- **TypeScript Check**: `npx tsc --noEmit` berhasil dieksekusi dengan status **0 error** (exit code 0).
- **Vite Dev Server**: Berjalan normal tanpa kompilasi error.
