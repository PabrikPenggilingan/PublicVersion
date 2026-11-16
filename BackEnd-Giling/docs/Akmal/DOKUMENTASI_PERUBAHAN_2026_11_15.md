# Dokumentasi Perubahan Backend (15 November 2026)

Branch: `AkmalDeploy` (staging). Migration baru: **095 – 100**.

Dokumen ini merangkum seluruh perubahan backend pada rilis ini: alur penjualan per truk (pengiriman), komisi calo per tonase, potongan customer, bukti kas (bayar/terima sekaligus), perbaikan logika Finance Center, pemisahan data per pabrik, dan beberapa perbaikan UX yang membutuhkan data baru.

Untuk perubahan tampilan lihat dokumen pasangan di repo frontend:
`FrontEnd-Giling/docs/Akmal/DOKUMENTASI_PERUBAHAN_2026_11_15.md`.

> Bagian **Rumus Laba Rugi** di dokumen 19 September 2026 sudah tidak berlaku untuk OPEX: biaya jemur, giling, dan transport beli sekarang hanya masuk lewat HPP (lihat §8).

---

## Daftar Isi

1. [Ringkasan](#1-ringkasan)
2. [Pembelian: Harga Sampai Tempat](#2-pembelian-harga-sampai-tempat)
3. [Penjualan: Pengiriman per Truk & Komisi Calo](#3-penjualan-pengiriman-per-truk--komisi-calo)
4. [Potongan Customer per Nota](#4-potongan-customer-per-nota)
5. [Bukti Kas: Bayar / Terima Sekaligus](#5-bukti-kas-bayar--terima-sekaligus)
6. [Perbaikan Finance Center](#6-perbaikan-finance-center)
7. [Data per Pabrik & Akses Finance](#7-data-per-pabrik--akses-finance)
8. [Rumus Lengkap Keuangan](#8-rumus-lengkap-keuangan)
9. [Chart of Accounts & Jurnal per Modul](#9-chart-of-accounts--jurnal-per-modul)
10. [Migration 095 – 100](#10-migration-095--100)
11. [API Baru / Berubah](#11-api-baru--berubah)
12. [File yang Berubah](#12-file-yang-berubah)
13. [Pengujian & Deploy](#13-pengujian--deploy)
14. [Catatan & Pekerjaan Lanjutan](#14-catatan--pekerjaan-lanjutan)

---

## 1. Ringkasan

| Area | Perubahan |
|---|---|
| Pembelian | `total_dibayar` (harga sampai tempat) bisa diedit; selisihnya jadi biaya transport. Foto struk wajib. |
| Penjualan | Transport & komisi calo dicatat **per truk (pengiriman)**, satu truk bisa membawa banyak nota. Komisi dihitung **per kg**. Ongkir yang dibayar customer dihapus. |
| Nota | **Potongan customer** (mis. kuli bongkar): Total Diterima bisa diedit, selisihnya jadi beban 5-700 dan mengurangi piutang. |
| Keuangan | **Bukti kas BKK/BKM**: beberapa transaksi tertunda disetujui sekaligus dalam satu bukti; jurnal tetap per jenis biaya. |
| Finance Center | 9+ bug logika diperbaiki (transaksi manual, piutang, nota ditolak, biaya ditolak, double counting OPEX, PDF, rekening tanpa kategori, jurnal pembalik tanpa pemilik, pendapatan jasa titipan). |
| Akses | Data dikelompokkan **per pabrik** (owner + user yang dia buat). Operator/viewer tidak bisa membuka Finance Center. |
| UX | Daftar pengeringan memakai tanggal belanja (`belanja_date`). |

---

## 2. Pembelian: Harga Sampai Tempat

- Kolom baru `trx.purchases.total_dibayar` (migration 095): harga yang dibayar sampai tempat (barang + transport).
- `total_harga` tetap = harga/kg × berat (nilai barang). Selisih `total_dibayar − total_harga` disarankan sebagai biaya transport (`suggestedTransportCost` di ringkasan batch form).
- Jurnal pembelian tetap: **Dr 1-300 Persediaan / Cr 2-100 Hutang** sebesar `total_harga`. Transport dicatat terpisah lewat logistik (Dr 5-200 / Cr Kas, PENDING).
- Input manual admin memakai form yang sama dengan form share; foto struk wajib.

---

## 3. Penjualan: Pengiriman per Truk & Komisi Calo

Alur bisnis: satu truk (mis. 10 ton) membawa beberapa nota, atau satu nota dengan beberapa harga. Customer membayar nota penuh; **pabrik** membayar transport dan komisi calo.

### Data
- `trx.logistics_tasks` dengan `reference_type = 'SALE'` sekarang = **pengiriman** (1 truk).
  - Kolom baru: `shipment_date`, `commission_rate_per_kg`, `commission_amount`, `commission_recipient`, `commission_transaction_id`.
  - `driver_name` sekarang boleh kosong (opsional).
- Tabel baru `trx.logistics_task_sales (logistics_task_id, sale_id)` — nota dalam pengiriman. Satu nota hanya boleh di satu pengiriman (`UNIQUE(sale_id)`).
- Kolom lama `trx.sales.transport_charge` (ongkir dibayar customer) **dihapus**.

### Aturan (`saleShipment.service.js`)
- Komisi = `tarif/kg × total kg muatan` (kg dari item ber-unit KG), kecuali total komisi diketik manual.
- Saat simpan, dua jurnal **PENDING** dibuat/diselaraskan (`utils/journalSync.js → syncExpenseJournal`):
  - Transport: **Dr 5-200 Beban Logistik / Cr Kas** (`reference_type = LOGISTICS`)
  - Komisi: **Dr 5-500 Beban Komisi Calo / Cr Kas** (`reference_type = CALO_PAYOUT`)
- Selama PENDING, mengubah nominal = jurnal lama dihapus dan dibuat ulang. Setelah **APPROVED**, nominal terkunci (error jika diubah).
- Hapus pengiriman ditolak jika ada jurnal yang sudah disetujui.
- Nota VOID otomatis dilepas dari pengiriman.
- Konfirmasi nota hanya memposting pendapatan; transport/komisi tidak lagi dibuat saat konfirmasi.
- Alokasi per nota (tampilan): bagian = kg nota ÷ total kg truk.

---

## 4. Potongan Customer per Nota

Untuk customer (toko besar) yang memotong pembayaran, mis. kuli bongkar. Nota resmi tetap utuh.

### Data (migration 097)
- `trx.sales.customer_deduction` (≥ 0), `deduction_note`, `deduction_journal_id`.
- `outstanding` (generated) = `total_amount − paid_amount − customer_deduction`.
- Trigger `trx.apply_sale_payment_status`: **PAID** jika `paid + potongan ≥ total`; PARTIAL jika ada bayar/potongan; selain itu UNPAID.

### Aturan (`salesV2.service.js`)
- `PUT /api/sales-v2/sales/:id/deduction { amount, note }` — hanya DRAFT/CONFIRMED; potongan ≤ total − dibayar.
- Jurnal: **Dr 5-700 Beban Kuli Bongkar & Potongan Penjualan / Cr 1-200 Piutang** (`SALE_DEDUCTION`, PENDING).
  - DRAFT: hanya disimpan; jurnal dibuat saat konfirmasi.
  - CONFIRMED: jurnal langsung dibuat; bisa diubah selama PENDING; terkunci setelah APPROVED.
- Ditolak Keuangan → potongan kembali 0. Nota VOID → jurnal potongan dihapus (PENDING) atau dibalik (APPROVED).

---

## 5. Bukti Kas: Bayar / Terima Sekaligus

### Data (migration 098)
- `trx.cash_vouchers (voucher_no, voucher_type IN/OUT, voucher_date, total_amount, notes, created_by)`.
- `trx.cash_voucher_items (voucher_id, journal_id UNIQUE, account_id, amount)`.
- Nomor: `BKK/YYYY/MM/NNN` (kas keluar) atau `BKM/YYYY/MM/NNN` (kas masuk), diurutkan dengan advisory lock.

### Aturan (`finance.service.js → payBatch`)
- Semua atau tidak sama sekali (satu transaksi DB).
- Semua jurnal harus PENDING, milik pabrik yang sama, dan satu arah (masuk saja atau keluar saja).
- Tiap item memakai rekening kas/bank masing-masing (boleh berbeda dalam satu bukti).
- Nominal item = **bagian kas** jurnal (baris kas/bank atau baris kosong), bukan total debit.
- Ditolak: jurnal tanpa uang kas (mis. potongan customer) dan transfer antar rekening.
- Setiap jurnal tetap di akunnya sendiri → laporan tetap terpisah per jenis biaya.

---

## 6. Perbaikan Finance Center

| # | Masalah sebelumnya | Perbaikan |
|---|---|---|
| 1 | Transaksi manual: sisi lawan kosong lalu diisi rekening kas saat approve → Kas/Kas, **saldo tidak berubah** | Sisi lawan sesuai kategori: Setoran Modal (Dr Kas / Cr 3-100), Prive baru `CAPITAL_OUT` (Dr 3-100 / Cr Kas), Operasional → dibuat sebagai **Overhead** (masuk Laba Rugi). Tipe & kategori divalidasi. |
| 2 | Piutang dashboard & neraca = total − dibayar (abaikan potongan) | Pakai `outstanding` (sudah dikurangi potongan); neraca historis juga mengurangi potongan. |
| 3 | Nota yang pendapatannya **ditolak** tetap CONFIRMED | Kembali ke **DRAFT** (jurnal potongan PENDING ikut dihapus). Nota COMPLETED tidak bisa ditolak → harus VOID. |
| 4 | Biaya jemur/giling/transport/komisi yang **ditolak** tetap masuk Laba Rugi | Dikecualikan dari laporan. |
| 5 | Jemur, giling, transport beli dihitung **dua kali** (sudah di HPP/kg + lagi di OPEX) | Dikeluarkan dari OPEX; ditampilkan sebagai info `productionCosts`. HPP/kg tidak diubah. |
| 6 | PDF: kategori overhead (Konsumsi, Utilities, dll) tidak tampil di rincian OPEX | Semua kategori tampil; catatan HPP sudah termasuk biaya produksi. |
| 7 | Rekening kas/bank tanpa `account_category` tidak muncul di Approval & Buku Besar | Kategori otomatis dari tipe saat dibuat; data lama diperbaiki (migration 099). Buku Besar memasukkan semua rekening CASH/BANK. |
| 8 | Jurnal pembalik (hapus pembelian / biaya giling) dibuat dengan `created_by = NULL` → tidak terhitung di saldo & laporan pemilik | Pakai pemilik jurnal asli; data lama diperbaiki (migration 099). |
| 9 | Transport dari form belanja batch tidak ditautkan ke jurnalnya | `finance_transaction_id` diisi. |
| 10 | Aktivitas terbaru: pembayaran customer tampil sebagai kas keluar | `SALE_PAYMENT` masuk daftar kas masuk. |
| 11 | Pendapatan **jasa titipan** (`TITIPAN_FEE`) tidak pernah masuk Laba Rugi | Ditambahkan ke pendapatan (`serviceRevenue`), kecuali yang ditolak. |
| 12 | Biaya pengiriman masuk periode menurut tanggal input | Menurut `shipment_date`. |
| 13 | Ledger rekening dicocokkan dengan nama | Baris ledger membawa `account_id`. |
| 14 | Approve/tolak jurnal pabrik lain bisa dilakukan jika tahu ID | Ditolak dengan 404. |

---

## 7. Data per Pabrik & Akses Finance

### Model (migration 100)
- `sys.users.owner_id` (FK ke `sys.users`):
  - `NULL` → user ini owner pabriknya sendiri.
  - `= X` → user ini anggota pabrik milik X.
- Pabrik (tenant) = `COALESCE(owner_id, id)`.

### Implementasi
- `middleware/auth.js` memuat `tenant_owner_id` dan `tenant_user_ids` (semua user sepabrik) ke `req.user` / request context.
- `utils/tenant.js`: `tenantIds()`, `tenantSql()`, `inTenant()`.
- Semua filter `created_by = user.id` di model/service diganti menjadi `created_by = ANY(tenant_user_ids)`: batch, pembelian, pendataan, pengeringan, proses, stok, customer, nota, logistik/pengiriman, dashboard, laporan & saldo keuangan, approval, bukti kas, margin per batch.
- User dibuat lewat `POST /api/users` otomatis mendapat `owner_id` = owner pabrik pembuatnya. `GET /api/users` dan ubah modul hanya untuk user sepabrik (super admin melihat semua).
- **User lama tidak dihubungkan otomatis** — tetap pabrik sendiri (tidak ada data yang berpindah).

### Akses Finance
- `requireFinanceAccess` pada semua route `/api/finance/*`: role `operator` dan `viewer` → **403**.
- Approve/tolak jurnal di luar pabrik → **404**.

---

## 8. Rumus Lengkap Keuangan

### HPP/kg (tidak diubah)
```
Gabah kering / kg = (Σ nilai gabah batch + Σ transport beli batch + biaya jemur ÷ jumlah batch)
                    ÷ berat gabah kering hasil jemur per batch
                    (kecuali HPP/kg diisi manual saat selesai jemur)

Beras / kg        = (kg gabah dipakai × harga gabah/kg + Σ biaya giling) ÷ total kg beras
                    harga gabah/kg: harga di proses → HPP/kg stok → (nilai + transport) ÷ berat batch → rata-rata pembelian
                    dedak/menir/sekam: HPP 0 (semua biaya dibebankan ke beras)
```

### Laba Rugi (`GET /api/finance/report`)
```
Pendapatan       = Σ total_amount nota (bukan DRAFT/VOID, menurut sale_date)
                 + Σ jasa titipan (TITIPAN_FEE, bukan REJECTED)
                 (potongan customer TIDAK mengurangi pendapatan)

HPP              = Σ (qty × hpp_per_unit) item nota (bukan DRAFT/VOID)
                   hpp_per_unit = HPP/kg stok saat dijual

OPEX             = Σ transport pengiriman penjualan (bukan REJECTED, menurut shipment_date)
                 + Σ komisi calo (bukan REJECTED)
                 + Σ potongan customer (nota bukan DRAFT/VOID)
                 + Σ overhead (APPROVED atau data lama tanpa jurnal)

Info (tidak dikurangkan): productionCosts = transport beli + jemur + giling periode ini (sudah di HPP)

Laba Kotor       = Pendapatan − HPP
Laba Operasional = Laba Kotor − OPEX
Margin kotor %   = Laba Kotor ÷ Pendapatan × 100
Belanja Gabah    = info modal kerja (bukan pengurang laba)
```

### Kas (saldo rekening & Buku Besar)
```
Saldo rekening = Σ (debit − kredit) jurnal APPROVED untuk akun aset/beban
                 Σ (kredit − debit) untuk kewajiban/ekuitas/pendapatan
Kas masuk      = pembayaran customer, setoran modal, jasa titipan
Kas keluar     = bayar hutang gabah, transport, jemur, giling, komisi, overhead, prive
```

### Neraca (`GET /api/finance/balance-sheet`)
```
Kas        = Σ baris jurnal APPROVED akun CASH/BANK
Persediaan = Σ sisa kg stok × HPP/kg
Piutang    = Σ outstanding nota (bukan DRAFT/VOID)            [historis: Σ(total − potongan) − Σ pembayaran]
Hutang     = Σ (total_harga − paid_amount) pembelian belum lunas
Ekuitas    = Aset − Kewajiban
```

### Contoh
| Langkah | Hitungan | Hasil |
|---|---|---|
| Beli 10.000 kg @ 6.000 + transport 1 jt + jemur 2 jt | 63 jt ÷ 8.500 kg kering | 7.411,76/kg |
| Giling 8.500 kg, biaya 1,5 jt, hasil 5.500 kg beras | 64,5 jt ÷ 5.500 | **11.727,27/kg** |
| Jual 5.000 kg @ 14.300 | | Pendapatan 71.500.000 |
| HPP | 5.000 × 11.727,27 | 58.636.364 |
| Laba kotor | | 12.863.636 |
| OPEX (pengiriman 800 rb + komisi 325 rb + potongan 100 rb + overhead 500 rb) | | 1.725.000 |
| **Laba operasional** | | **11.138.636** |

---

## 9. Chart of Accounts & Jurnal per Modul

Akun baru: **5-500 Beban Komisi Calo** (096), **5-700 Beban Kuli Bongkar & Potongan Penjualan** (097).

| Modul | reference_type | Jurnal | Status awal | Jika ditolak |
|---|---|---|---|---|
| Pembelian gabah | PURCHASE | Dr 1-300 / Cr 2-100 | APPROVED | – |
| Bayar hutang (satu / batch) | PURCHASE_PAYMENT / BATCH_PAYMENT | Dr 2-100 / Cr Kas | PENDING | pembayaran dibatalkan |
| Transport beli | LOGISTICS | Dr 5-200 / Cr Kas | PENDING | tidak dihitung |
| Biaya jemur | DRYING_COST | Dr 5-300 / Cr Kas | PENDING | tidak dihitung |
| Biaya giling | MILLING | Dr 5-400 / Cr Kas | PENDING | tidak dihitung |
| Konfirmasi nota | SALE | Dr Kas (bagian dibayar) + Dr 1-200 / Cr 4-100 | PENDING | nota → DRAFT |
| Pembayaran customer | SALE_PAYMENT | Dr Kas / Cr 1-200 | PENDING | pembayaran dihapus |
| Potongan customer | SALE_DEDUCTION | Dr 5-700 / Cr 1-200 | PENDING | potongan → 0 |
| Pengiriman: transport | LOGISTICS | Dr 5-200 / Cr Kas | PENDING | tidak dihitung |
| Pengiriman: komisi | CALO_PAYOUT | Dr 5-500 / Cr Kas | PENDING | tidak dihitung |
| Overhead / operasional manual | OVERHEAD | Dr 5-600 / Cr Kas | PENDING | overhead dihapus |
| Setoran modal | CAPITAL_IN | Dr Kas / Cr 3-100 | PENDING | – |
| Prive | CAPITAL_OUT | Dr 3-100 / Cr Kas | PENDING | – |
| Jasa titipan | TITIPAN_FEE | Dr Kas / Cr 4-100 | PENDING | tidak dihitung |
| Transfer antar rekening | TRANSFER | Dr Kas tujuan / Cr Kas asal | APPROVED | – |
| Pembatalan | VOID | kebalikan jurnal asli | APPROVED | – |

"Cr Kas" pada jurnal PENDING = baris tanpa akun; rekening kas/bank dipilih saat approval (satu-satu atau lewat bukti kas).

---

## 10. Migration 095 – 100

Semua idempotent (aman dijalankan ulang). Dijalankan otomatis oleh `npm start` di staging.

| File | Isi |
|---|---|
| `095_harga_sampai_tempat.sql` | `trx.purchases.total_dibayar` + check constraint |
| `096_sale_shipments.sql` | Hapus `trx.sales.transport_charge` (+ trigger/fungsi); kolom pengiriman & komisi di `logistics_tasks`; tabel `logistics_task_sales`; backfill pengiriman lama; akun 5-500; `driver_name` boleh NULL |
| `097_sale_customer_deduction.sql` | Kolom potongan; **rebuild** kolom generated `outstanding` dan view `public.sales` (+ trigger INSTEAD OF, hardening 094); trigger status bayar; akun 5-700 |
| `098_cash_vouchers.sql` | Tabel `cash_vouchers` & `cash_voucher_items` (RLS on) |
| `099_finance_data_repair.sql` | Isi `account_category` kosong sesuai tipe; isi `created_by` jurnal VOID dari jurnal aslinya |
| `100_user_owner_pabrik.sql` | `sys.users.owner_id` + FK, check, index |

⚠️ **097** adalah yang paling sensitif (drop/recreate `public.sales` dan kolom `outstanding`). Jika deploy gagal, cek log migration ini lebih dulu.

---

## 11. API Baru / Berubah

| Method & Path | Keterangan |
|---|---|
| `GET /api/logistics/shipments` | Daftar pengiriman (nota, kg, status jurnal) |
| `GET /api/logistics/shipments/available-sales?excludeShipmentId=` | Nota yang belum masuk pengiriman |
| `GET /api/logistics/shipments/:id` | Detail pengiriman |
| `POST /api/logistics/shipments` | Buat pengiriman `{ saleIds[], shipmentDate, driverName?, crewNames, origin, destination, durationHours, operationalCost, commissionRatePerKg, commissionAmount?, commissionRecipient?, notes }` |
| `PUT /api/logistics/shipments/:id` | Ubah pengiriman |
| `DELETE /api/logistics/shipments/:id` | Hapus (ditolak jika jurnal sudah disetujui) |
| `POST /api/logistics` | `referenceType` sekarang hanya `PURCHASE` (penjualan lewat shipments) |
| `PUT /api/sales-v2/sales/:id/deduction` | `{ amount, note }` potongan customer |
| `POST /api/sales-v2/sales/:id/confirm` | Tanpa body (transport tidak lagi lewat sini) |
| ~~`PUT /api/sales-v2/sales/:id/transport`~~ | Dihapus |
| `GET /api/sales-v2/sales/:id` | Tambahan `shipment`, `cash_flow { transport, commission, deduction: { status, voucher_no } }` |
| `POST /api/finance/vouchers` | `{ items: [{ journalId, accountId }], voucherDate?, notes? }` bayar/terima sekaligus |
| `GET /api/finance/vouchers` / `:id` | Riwayat bukti kas |
| `GET /api/finance/approvals` | Tambahan `cash_amount` per transaksi |
| `GET /api/finance/report` | Tambahan `productionCosts`, `productionCostsTotal`, `serviceRevenue`, `salesRevenue`, `revenueBreakdown.service`; ledger membawa `account_id` |
| `POST /api/finance/transactions/manual` | Kategori: `CAPITAL_IN` (IN), `CAPITAL_OUT` (OUT), `OVERHEAD` (OUT) |
| `/api/finance/*` | 403 untuk operator/viewer |
| `POST /api/users` | User baru otomatis masuk pabrik pembuat |
| `GET /api/drying` | Tambahan `belanja_date` per pengeringan |

---

## 12. File yang Berubah

**Baru**
- `src/models/saleShipment.model.js`, `src/services/saleShipment.service.js`, `src/controllers/saleShipment.controller.js`
- `src/models/cashVoucher.model.js`
- `src/utils/journalSync.js` (sinkron jurnal biaya yang bisa diedit)
- `src/utils/tenant.js` (data per pabrik)
- `migrations/095` – `100`

**Diubah (utama)**
- Keuangan: `models/finance.model.js`, `services/finance.service.js`, `services/pdf.service.js`, `controllers/finance.controller.js`, `routes/finance.routes.js`, `validators/finance.validator.js`, `utils/accounting.map.js`
- Penjualan: `services/salesV2.service.js`, `controllers/salesV2.controller.js`, `routes/salesV2.routes.js`, `validators/salesV2.validator.js`, `models/sale.model.js`
- Logistik: `routes/logistics.routes.js`, `validators/logistics.validator.js`, `models/logistics.model.js`
- Pembelian: `services/purchase.service.js`, `services/form.service.js`, `dtos/purchase.dto.js`, `dtos/form.dto.js`, `mappers/purchase.mapper.js`, `validators/purchase.validator.js`
- Akses & pabrik: `middleware/auth.js`, `models/user.model.js`, `services/auth.service.js`, `controllers/users.controller.js`, serta filter di `models/{batch,customer,dryingProcess,inventoryItem,pendataanGabah,process,purchase}.model.js`, `services/{batch,dashboard,process}.service.js`

---

## 13. Pengujian & Deploy

Diuji di database lokal (`backend/.env`, `gabahDb`), data uji dibersihkan setelahnya:
- Pengiriman 2 nota (10.000 kg × Rp 65 = komisi 650 rb, transport 1 jt), kunci setelah approve, hapus diblok.
- Potongan Rp 100 rb pada nota 28 jt → lunas; tolak → 0; VOID → dibalik.
- Bukti kas BKK Rp 1,65 jt (transport + komisi), campuran masuk/keluar ditolak, bayar ganda ditolak.
- Transaksi manual setoran modal → Kas & Modal +1 jt; overhead ditolak → hilang dari laporan; nota ditolak → DRAFT.
- Piutang dashboard = neraca = Σ outstanding.
- Pabrik: operator 403 di Finance; owner melihat jurnal operator; pabrik lain tidak melihat & approve 404; semua daftar data admin tetap terisi.

Deploy staging: push ke `AkmalDeploy` → Cloud Run menjalankan `npm start` (migration otomatis). Jangan push ke `main` tanpa persetujuan. Jangan menjalankan migration lokal dengan `.env` root (mengarah ke Supabase).

Cek setelah deploy: Approval Center, kartu Arus Uang di detail nota, Laba Rugi & PDF, Logistik → Pengiriman.

---

## 14. Catatan & Pekerjaan Lanjutan

Belum dikerjakan (disepakati untuk nanti):
1. **Retur belum mengurangi HPP** — HPP dihitung dari qty pesanan; seharusnya (qty − retur).
2. **Overhead** baru masuk OPEX setelah disetujui, biaya lain sejak dicatat — samakan.
3. **Beras patah (BROKEN)** mendapat HPP/kg beras tapi tidak ikut pembagi kg → total HPP lebih besar dari biaya.
4. **Jemur multi-batch** membagi hasil & biaya sama rata per batch, bukan menurut berat.
5. Biaya jemur yang ditambah setelah pengeringan selesai belum menghitung ulang HPP/kg.

Catatan lain:
- Data uji lama (±28 pembelian & 8 nota Juli–Agustus) tidak punya jurnal; muncul di laporan tapi tidak di Buku Besar.
- User lama tidak dihubungkan ke owner (keputusan: tidak perlu).
