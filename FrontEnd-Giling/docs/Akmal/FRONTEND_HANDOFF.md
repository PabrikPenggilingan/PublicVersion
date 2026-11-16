# Frontend Handoff Guide - Finance Redesign
**Penulis**: Antigravity (Google DeepMind)  
**Tujuan**: Panduan cepat bagi developer untuk meninjau perubahan visual & fungsional pada Modul Keuangan (Finance Center).

---

## 📂 Struktur File Baru & Modifikasi
Berikut adalah file yang perlu Anda ketahui jika ingin mengubah UI/UX keuangan:

1.  **Sidebar Menu (`Sidebar.tsx`)**:
    *   **Lokasi**: [`src/components/layout/Sidebar.tsx`](file:///c:/GAWEH/COLLECT%20DATA%20GABAH/src/FrontEnd-Giling/src/components/layout/Sidebar.tsx)
    *   **Peran**: Mengelompokkan menu keuangan ke dalam satu dropdown lipat (*collapsible accordion*).
2.  **Daftar Rute URL (`App.tsx`)**:
    *   **Lokasi**: [`src/App.tsx`](file:///c:/GAWEH/COLLECT%20DATA%20GABAH/src/FrontEnd-Giling/src/App.tsx)
    *   **Peran**: Mendaftarkan URL fisik terpisah untuk setiap sub-menu keuangan.
3.  **Klien API Keuangan (`client.ts`)**:
    *   **Lokasi**: [`src/api/client.ts`](file:///c:/GAWEH/COLLECT%20DATA%20GABAH/src/FrontEnd-Giling/src/api/client.ts)
    *   **Peran**: Mendeklarasikan pemanggilan HTTP request ke Backend (ditambahkan endpoint detail transaksi, transfer dana, dan jurnal manual).
4.  **Halaman Utama / Overview (`FinanceDashboard.tsx`)**:
    *   **Lokasi**: [`src/pages/FinanceDashboard.tsx`](file:///c:/GAWEH/COLLECT%20DATA%20GABAH/src/FrontEnd-Giling/src/pages/FinanceDashboard.tsx)
    *   **Peran**: Layar ringkasan (EBITDA harian, Neraca Saldo visual, aktivitas kas terbaru, dan saldo kas).
5.  **Persetujuan Kas / Approvals (`ApprovalManager.tsx`)**:
    *   **Lokasi**: [`src/pages/ApprovalManager.tsx`](file:///c:/GAWEH/COLLECT%20DATA%20GABAH/src/FrontEnd-Giling/src/pages/ApprovalManager.tsx)
    *   **Peran**: Halaman *Dark Mode* untuk menyetujui transaksi operasional harian yang tertunda.
6.  **Buku Besar Keuangan / Ledger (`FinanceLedger.tsx`) [BARU]**:
    *   **Lokasi**: [`src/pages/FinanceLedger.tsx`](file:///c:/GAWEH/COLLECT%20DATA%20GABAH/src/FrontEnd-Giling/src/pages/FinanceLedger.tsx)
    *   **Peran**: Tabel lengkap jurnal kas masuk/keluar dengan fitur modal inspeksi relasi data operasional.
7.  **Rekening & Transfer (`FinanceAccounts.tsx`) [BARU]**:
    *   **Lokasi**: [`src/pages/FinanceAccounts.tsx`](file:///c:/GAWEH/COLLECT%20DATA%20GABAH/src/FrontEnd-Giling/src/pages/FinanceAccounts.tsx)
    *   **Peran**: Kartu visual rekening bank, form transfer internal, penyesuaian modal manual, dan buku pembantu kas harian.

---

## 🛠️ Panduan Praktis Developer (How-To)

### 1. Bagaimana Cara Menambahkan Sub-Menu Baru di Sidebar?
Buka [`Sidebar.tsx`](file:///c:/GAWEH/COLLECT%20DATA%20GABAH/src/FrontEnd-Giling/src/components/layout/Sidebar.tsx) dan cari variabel `NAV_ITEMS`. Cari bagian `path: '/finance'`. Cukup tambahkan objek baru ke dalam array `children`:
```typescript
{
    path: '/finance', icon: Landmark, label: 'Finance Center', minTier: 'TIER_B',
    children: [
        ...
        { label: 'Menu Baru', categoryCode: 'FIN_BARU', icon: <Plus size={14} />, color: '#3B82F6' }
    ]
}
```
Kemudian, pastikan Anda mendaftarkan rute halamannya di [`App.tsx`](file:///c:/GAWEH/COLLECT%20DATA%20GABAH/src/FrontEnd-Giling/src/App.tsx) dan menambahkan logika pemetaan URL-nya di fungsi `handleSubNav` dan `isActive` di [`Sidebar.tsx`](file:///c:/GAWEH/COLLECT%20DATA%20GABAH/src/FrontEnd-Giling/src/components/layout/Sidebar.tsx).

---

### 2. Bagaimana Cara Kerja "Modal Detail Relasi" di Buku Besar?
Di dalam [`FinanceLedger.tsx`](file:///c:/GAWEH/COLLECT%20DATA%20GABAH/src/FrontEnd-Giling/src/pages/FinanceLedger.tsx), ketika baris transaksi diklik:
1.  Fungsi `handleOpenDetail(tx)` dipanggil.
2.  React memicu modal terbuka dan menampilkan loading spinner.
3.  Mengirim request ke API backend: `financeAPI.getTransactionDetail(tx.id)`.
4.  Data respons dari server berisi detail transaksi ledger beserta objek `relatedData` (data operasional asal).
5.  Menggunakan kondisi `selectedTx.source_module === 'SALES' | 'PURCHASE' | 'PROCESS' | ...` untuk menampilkan kolom metadata yang sesuai (misal: berat gabah untuk pembelian, nama pembeli untuk penjualan).

---

### 3. Konsistensi Tema Dark Mode & Tailwind
Seluruh styling menggunakan Tailwind CSS. 
*   **Warna Latar Belakang**: `bg-dark-800` (kartu), `bg-dark-900` (halaman utama).
*   **Warna Garis Tepi**: `border-dark-700` atau `border-white/5` untuk garis halus.
*   **Warna Teks**: `text-white` (teks utama), `text-dark-400` (subtitel/keterangan).
*   **Status Positif (Kas Masuk)**: `text-emerald-400`, `bg-emerald-500/10` (hijau bercahaya).
*   **Status Negatif (Kas Keluar/Hutang)**: `text-rose-400`, `bg-rose-500/10` (merah rose bercahaya).

---

## 💬 Tips untuk Review Cepat
*   Jika Anda mengalami error kompilasi TypeScript di halaman baru, periksa jenis props pada komponen pembangun seperti `<Input />` atau `<Modal />`. Komponen `<Input />` di project ini menggunakan standard `forwardRef`, sehingga penangan `onChange` harus menggunakan event browser standard (`e => ...`), bukan nilai langsung string.
*   Pustaka ikon yang digunakan adalah `lucide-react`. Gunakan ukuran `size={14}` untuk sub-menu sidebar dan `w-5 h-5` untuk tombol aksi.
