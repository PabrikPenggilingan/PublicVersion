# 📱 Pembaruan Antarmuka (UI) Mobile (20 Sep 2026)

Dokumen ini mencatat berbagai penyesuaian tata letak (layout) dan ukuran komponen yang dilakukan untuk mengoptimalkan pengalaman pengguna pada perangkat mobile, khususnya dalam mencegah *horizontal scrolling* dan merapikan komponen yang memakan terlalu banyak ruang layar.

---

## 📄 1. Form Pembelian (`PurchaseForm.tsx`)

* **Horizontal Overflow Fix**: Menambahkan `w-full overflow-x-hidden` pada seluruh container utama `max-w-md` agar form tidak melebar keluar batas layar handphone (mencegah user terpaksa *scroll* ke samping).
* **Aggressive Right-Sizing**:
  * Padding pada input form diperkecil dari `py-4` menjadi `py-3 px-3`.
  * Ukuran teks input dan *placeholder* diperkecil menjadi `text-sm`.
  * Ukuran font label diubah menjadi `text-xs font-semibold`.
  * Ukuran header judul form diperkecil dari `text-lg` menjadi `text-base`.
  * Kotak pratinjau (preview) foto upload diperkecil secara signifikan dari `w-24 h-24` menjadi `w-16 h-16`.
  * Jarak vertikal antar komponen dikurangi dari `space-y-4` menjadi `space-y-3`.
* **Sticky Bottom Bar**: Mengurangi padding pada area tombol aksi bawah agar ruang konten utama form menjadi lebih lega.

---

## 📋 2. Daftar Pengeringan (`DryingList.tsx`)

* **Tombol Aksi**: Memperkecil dimensi tombol **"Pengeringan Baru"** di bagian atas tabel (ukuran icon menjadi `size={16}`, padding `px-3 py-1.5`, dan teks `text-sm`).
* **Badge Status Kolom**: Memperkecil ukuran teks status menjadi `text-[10px]` dan memaksa teks tetap dalam satu baris horizontal dengan `whitespace-nowrap`, menghindari *badge* yang tinggi akibat teks patah.

---

## 🔍 3. Detail Pengeringan (`DryingDetail.tsx`)

* **Alur Pengeringan**: Mengubah layout *timeline* status (Batch Terpilih, Mulai, Selesai, Masuk Gudang) menggunakan grid 2x2 (`grid grid-cols-2`) khusus pada tampilan mobile, menggantikan tumpukan kolom tunggal vertikal.
* **Stats Dashboard**: Mengatur grid kartu indikator (Total Batch, Berat Awal, dsb.) di bagian atas halaman agar tersusun rapi menjadi 2 kolom (`grid-cols-2`) saat dibuka via HP.

---

## 📊 4. Dashboard Utama (`Dashboard.tsx`)

* **Stats Grid**: Memperbaiki grid kartu rangkuman statistik utama agar secara dinamis menggunakan layout kolom ganda (`grid-cols-2`) pada mobile, sehingga tidak memanjang jauh ke bawah secara tidak proporsional.
