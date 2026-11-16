# Dokumentasi Perubahan Frontend (15 November 2026)

Branch: `AkmalDeploy` (staging).

Dokumen ini merangkum perubahan tampilan dan alur pengguna pada rilis ini. Logika bisnis, rumus keuangan, jurnal, migration, dan API dijelaskan lengkap di dokumen backend:
`BackEnd-Giling/docs/Akmal/DOKUMENTASI_PERUBAHAN_2026_11_15.md`.

---

## 1. Ringkasan per Halaman

| Halaman | Perubahan |
|---|---|
| Form Belanja (`form/PurchaseForm.tsx`) | Harga sampai tempat (total dibayar) bisa diedit; selisih jadi saran biaya transport; foto struk wajib |
| Detail Batch (`BatchDetail.tsx`) | Tombol tambah pembelian membuka form yang sama dengan link share; kolom total dibayar & selisih transport |
| Logistik (`Logistics.tsx`) | Tab Penjualan = **Pengiriman per truk** (banyak nota), komisi calo, status jurnal |
| Modal Pengiriman (`components/SaleShipmentModal.tsx`, baru) | Pilih nota, supir (opsional), rute, biaya transport, komisi calo per kg, alokasi per nota |
| Detail Nota (`SalesDetail.tsx`) | Tab Transport menampilkan pengiriman; **potongan customer**; kartu **Arus Uang Nota Ini** |
| PDF Nota (`utils/pdfGenerator.ts`) | Baris potongan; ongkir customer dihapus |
| Approval Center (`ApprovalManager.tsx`) | Centang beberapa transaksi → **Bayar/Terima Sekaligus** (BKK/BKM), riwayat bukti kas |
| Finance Dashboard (`FinanceDashboard.tsx`) | Label HPP/OPEX baru, info biaya produksi (masuk HPP), info jasa titipan |
| Rekening (`FinanceAccounts.tsx`) | Hanya rekening kas/bank; riwayat per ID; transaksi manual dengan kategori sesuai tipe (+ Prive) |
| Buku Besar (`FinanceLedger.tsx`) | Label kategori baru |
| Sidebar (`components/layout/Sidebar.tsx`) | Finance Center disembunyikan untuk operator/viewer |
| Proses Giling (`Processes.tsx`) | Baris bisa diklik; tanggal proses otomatis = tanggal belanja |
| Pengeringan (`DryingList.tsx`) | Daftar menampilkan tanggal belanja; nama default dari tanggal & tonase belanja |

---

## 2. Pembelian

- **Total Dibayar (harga sampai tempat):** default = harga × berat; bisa diubah. Jika lebih besar, selisihnya ditampilkan sebagai biaya transport dan disarankan ke langkah logistik form batch. Tidak boleh lebih kecil dari nilai gabah.
- **Input manual admin** di Detail Batch membuka form share yang sama (`/form/batch/:code`), memakai link PURCHASE aktif atau membuat baru. Batch yang sudah diselesaikan tidak bisa ditambah.
- **Foto struk wajib** di form.

---

## 3. Pengiriman Penjualan (Logistik → tab Penjualan)

- Tombol **Pengiriman Baru** membuka `SaleShipmentModal`:
  - Checklist nota yang belum masuk pengiriman (dengan total kg).
  - Tanggal kirim, nama supir (**opsional**), kru, durasi, asal, tujuan.
  - **Biaya Transport** (dibayar pabrik).
  - **Komisi Calo**: nama (opsional), tarif per kg, total komisi = tarif × kg (bisa diubah; tombol "Pakai hitungan").
  - Tabel alokasi per nota (proporsional kg) dan bar total.
  - Nominal terkunci setelah disetujui Keuangan.
- Tabel: tanggal kirim, nota (tautan), supir & rute, muatan, transport + status, komisi + status, ubah/hapus.
- Deep link: `/logistics?tab=SALE&newSale=<saleId>` (buat dari nota) dan `&shipment=<id>` (buka pengiriman).

---

## 4. Detail Nota

### Tab Transport
- Kartu pengiriman: supir/rute, muatan & bagian nota ini (%), chip nota lain dalam truk, tabel biaya total vs bagian nota, tautan "Ubah Pengiriman".
- Belum ada pengiriman → tombol **Buat Pengiriman** (modal dengan nota ini terpilih).

### Ringkasan Biaya → Potongan Customer (DRAFT/CONFIRMED)
- **Total Diterima dari Customer** (default = nilai nota) bisa dikosongkan penuh lalu diketik ulang; saat kosong potongan tidak berubah, saat ditinggalkan kembali ke angka terakhir.
- **Potongan** terisi otomatis dari selisih, bisa diedit dan dikosongkan.
- **Keterangan** (default "Kuli bongkar"), tombol Batal / Simpan Potongan saat ada perubahan.
- Baris "Dipotong Customer" di bawah Sudah Dibayar; dialog konfirmasi menyebut potongan.

### Tab Pembayaran → Arus Uang Nota Ini
Nilai nota, uang masuk dari customer, potongan, bagian transport & komisi (status "menunggu Keuangan" / "✓ dibayar · BKK/…"), **Bersih diterima**, dan sisa tagihan.

---

## 5. Approval Center

- Checkbox per transaksi; tombol cepat **Semua kas keluar** / **Semua kas masuk** / Batal pilih.
- Transaksi tanpa uang kas (potongan customer) dan transfer tidak bisa dicentang.
- Kas masuk dan kas keluar tidak bisa dicampur.
- Bar bawah: jumlah dipilih + total → **Bayar Sekaligus** / **Terima Sekaligus**.
- Dialog: tanggal bukti kas, "Pakai satu rekening untuk semua", rekening per baris, catatan, subtotal per rekening.
- **Bukti Kas Terakhir**: daftar BKK/BKM yang bisa dibuka untuk melihat rincian.

---

## 6. Finance Center Lainnya

- **Finance Dashboard**
  - HPP: "Total Modal Beras Terjual — Gabah + transport beli + jemur + giling" + info "Biaya produksi periode ini … (masuk HPP)".
  - OPEX: "Beban Penjualan & Umum — Pengiriman, komisi calo, potongan & overhead".
  - Revenue: "Termasuk jasa titipan Rp …" bila ada.
- **Rekening & Transfer**
  - Kartu hanya rekening kas/bank; default form tidak tertimpa saat reload.
  - Transaksi manual: Kas Masuk → Setoran Modal; Kas Keluar → Biaya Operasional (masuk Overhead) atau Penarikan Modal/Prive.
  - Riwayat rekening dicocokkan dengan `account_id`.
- **Label kategori baru**: `CALO_PAYOUT` (Komisi Calo), `SALE_DEDUCTION` (Potongan Customer), `CAPITAL_OUT` (Prive).

---

## 7. Proses Giling & Pengeringan

- **Proses Giling**
  - Seluruh baris tabel membuka detail (tombol Detail/Hapus tetap jalan).
  - Buat proses: memilih gabah mengisi **Tanggal Proses = tanggal belanja** (bisa diubah) dan kg = sisa stok.
  - Pilihan gabah diawali "Belanja <tanggal> · <tonase belanja> kg · sisa … kg" (titipan: "Masuk <tanggal>").
- **Pengeringan**
  - Daftar menampilkan "Belanja <tanggal>" dari batch yang dijemur (fallback tanggal input).
  - Nama default: "Pengeringan Belanja <tanggal> · <tonase> kg" bila nama dikosongkan.

---

## 8. API Client & Types

- `api/client.ts`
  - `salesV2API.confirm(id)` tanpa body; `saveTransport` dihapus; `setDeduction(id, { amount, note })`.
  - `shipmentsAPI` (getAll, getById, getAvailableSales, create, update, delete) + tipe `SaleShipment`, `ShipmentSale`, `SaleShipmentInput`.
  - `financeAPI.payBatch`, `financeAPI.getVouchers` + tipe `CashVoucher`, `CashVoucherItem`.
- `types/index.ts` (`SaleV2`)
  - Tambah `shipment`, `customer_deduction`, `deduction_note`, `deduction_journal_id`, `cash_flow`.
  - Hapus `transport_charge`/`transport`.

---

## 9. Verifikasi

- `npx tsc --noEmit` dan `npm run build` lulus.
- Dicek di browser lokal (`http://localhost:5173`) dengan backend lokal: alur pengiriman, potongan, Arus Uang, Approval Bayar Sekaligus, Rekening, dashboard, klik baris proses, tanggal belanja di form proses & daftar pengeringan.
