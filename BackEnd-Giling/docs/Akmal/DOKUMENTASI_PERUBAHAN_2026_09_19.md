# Dokumentasi Perubahan Backend (19 September 2026)

Dokumen ini merangkum seluruh pembaruan arsitektur kalkulasi biaya produksi (*Absorption/Process Costing*), rekonsiliasi buku besar akuntansi, dan perbaikan pelaporan laba/rugi per batch pada backend **Belanja Giling Management System** pada tanggal 19 September 2026.

---

## 1. Rantai Akumulasi Biaya Produksi Bertingkat (*Process Costing*)

Sesuai dengan keputusan bisnis dan kaidah akuntansi manufaktur penggilingan padi, sistem kini mengadopsi model **akumulasi biaya berjenjang** di mana setiap komoditas menyerap seluruh modal bahan baku, ongkos angkut, biaya proses langsung, serta efek penyusutan bobot air.

### A. Kapitalisasi Ongkos Logistik Pembelian (Landed Cost Gabah Basah)
- **Lokasi File:** 
  - [`src/services/inventory.service.js`](file:///c:/GAWEEE/HETI%20SY/src/BackEnd-Giling/backend/src/services/inventory.service.js)
  - [`src/services/process.service.js`](file:///c:/GAWEEE/HETI%20SY/src/BackEnd-Giling/backend/src/services/process.service.js)
- **Implementasi:**
  - Biaya transportasi yang tercatat pada modul logistik (`trx.logistics_tasks` dengan `reference_type = 'PURCHASE'`) ditarik secara otomatis berdasarkan pembelian di batch terkait.
  - Pada metode `createFromBatch` dan fallback `_resolveGabahPrice`:
    $$\text{Modal Gabah Basah} = \sum \text{total\_harga pembelian} + \sum \text{operational\_cost logistik}$$
    $$\text{Harga Perolehan/kg} = \frac{\text{Modal Gabah Basah}}{\text{Total Berat Gabah Basah (kg)}}$$

---

### B. Akumulasi Biaya Pengeringan & Efek Susut Bobot (HPP Gabah Kering)
- **Lokasi File:** [`src/services/inventory.service.js`](file:///c:/GAWEEE/HETI%20SY/src/BackEnd-Giling/backend/src/services/inventory.service.js) (Metode `createFromDrying`)
- **Masalah Sebelumnya:**
  - Harga pokok gabah kering sebelumnya hanya dihitung dari `totalCost / beratBasah` sehingga penyusutan bobot air menyebabkan modal persediaan menguap/tercatat terlalu rendah (*undervalued*), serta biaya jemur (`trx.drying_costs`) belum diikutsertakan.
- **Formula Baru yang Diterapkan:**
  $$\text{Total Modal GKG} = \text{Modal Gabah Basah} + \text{Biaya Logistik} + \sum \text{Biaya Pengeringan (trx.drying\_costs)}$$
  $$\mathbf{HPP\ Gabah\ Kering / kg} = \frac{\text{Total Modal GKG}}{\text{Berat Gabah Kering Riil Hasil Jemur (tonnagePerBatch)}}$$
- **Efek:** 
  1. Biaya operasional jemur (upah, solar, kayu, listrik) langsung masuk menjadi aset persediaan gabah kering.
  2. Efek susut air otomatis diserap secara proporsional ke harga satuan per kg.
  3. Nilai `avg_price_per_kg` pada item `trx.inventory_items` (kategori `GABAH_KERING`) dan `hpp_per_kg` pada `trx.drying_sessions` tersimpan secara presisi.

---

### C. Alokasi Biaya Penggilingan & Preservasi Asal Batch Beras
- **Lokasi File:** [`src/services/process.service.js`](file:///c:/GAWEEE/HETI%20SY/src/BackEnd-Giling/backend/src/services/process.service.js) (Metode `completeProcess`)
- **Implementasi:**
  1. **Alokasi 100% Modal ke Beras Utama:**
     $$\text{Total Modal Beras} = (\text{Gabah Kering Digiling (kg)} \times \text{HPP GKG}) + \sum \text{Biaya Giling (trx.process\_costs)}$$
     $$\mathbf{HPP\ Beras / kg} = \frac{\text{Total Modal Beras}}{\text{Total Hasil Beras Jadi (kg)}}$$
     - Dedak, menir (`TURUNAN`), dan sekam (`LIMBAH`) diberi nilai modal Rp 0/kg (seluruh hasil penjualan dedak/sekam kelak langsung menjadi laba kotor).
  2. **Preservasi Identitas Batch Asal:**
     - Saat output beras (`BERAS`), dedak, dan sekam dibuat di tabel `trx.inventory_items`, sistem kini menyuntikkan `batchId: originBatchId` (`process.gabah_batch_id || process.batches[0]?.batch_id`).
     - Dengan demikian, rantai silsilah dari batch gabah ke stok beras tidak terputus.

---

## 2. Perbaikan Fitur "Analisis Margin per Batch"

### Lokasi File:
- [`src/services/batch.service.js`](file:///c:/GAWEEE/HETI%20SY/src/BackEnd-Giling/backend/src/services/batch.service.js) (Metode `getBatchMarginReport` & `getAllBatchMarginReports`)

### Masalah yang Ditemukan:
- Kolom **Revenue (Sales)** pada tabel *Analisis Margin per Batch* sebelumnya selalu bernilai `Rp 0` sehingga nilai **Net Margin** bernilai minus penuh (*full minus*).
- **Akar Masalah:** Query penjualan pada tabel `trx.sale_items` sebelumnya hanya mencari kecocokan `ii.batch_id = $1`. Padahal beras yang dijual dihasilkan dari proses giling (`process_id`) yang sebelumnya belum memiliki `batch_id` langsung pada baris inventaris output.

### Solusi & Rekonstruksi Query:
Query SQL pada `sales_agg` dan `getBatchMarginReport` diperbarui dengan teknik penelusuran relasi bertingkat:
```sql
sales_agg AS (
  SELECT 
    COALESCE(ii.batch_id, input_ii.batch_id, pb.batch_id) as batch_id,
    COALESCE(SUM(si.subtotal), 0) as revenue
  FROM trx.sale_items si
  JOIN trx.inventory_items ii ON si.inventory_item_id = ii.id
  JOIN trx.sales s ON si.sale_id = s.id
  LEFT JOIN trx.processes p ON ii.process_id = p.id
  LEFT JOIN trx.inventory_items input_ii ON p.inventory_item_id = input_ii.id
  LEFT JOIN trx.process_batches pb ON p.id = pb.process_id
  WHERE s.status NOT IN ('VOID', 'DRAFT')
    AND COALESCE(ii.batch_id, input_ii.batch_id, pb.batch_id) IN (SELECT id FROM batch_list)
  GROUP BY COALESCE(ii.batch_id, input_ii.batch_id, pb.batch_id)
)
```
- **Hasil:** Baik data historis maupun transaksi baru kini otomatis menghubungkan nota penjualan beras ke batch gabah asalnya.
- **Hasil Riil Uji Coba (Batch `1863a4bc`):**
  - **Revenue:** **Rp 227.400.000** *(sebelumnya Rp 0)*
  - **Total COGM:** **Rp 151.750.000**
  - **Net Margin:** **+ Rp 75.650.000** *(sehat dan untung)*

---

## 3. Database Migration Script

### Lokasi File:
- [`backend/migrations/089_backfill_inventory_batch_id.sql`](file:///c:/GAWEEE/HETI%20SY/src/BackEnd-Giling/backend/migrations/089_backfill_inventory_batch_id.sql)

### Isi Migrasi:
```sql
-- Migration 089: Backfill batch_id on inventory items produced from milling processes
UPDATE trx.inventory_items ii
SET batch_id = COALESCE(input_ii.batch_id, pb.batch_id)
FROM trx.processes p
LEFT JOIN trx.inventory_items input_ii ON p.inventory_item_id = input_ii.id
LEFT JOIN trx.process_batches pb ON p.id = pb.process_id
WHERE ii.process_id = p.id 
  AND ii.batch_id IS NULL 
  AND COALESCE(input_ii.batch_id, pb.batch_id) IS NOT NULL;
```
Migrasi ini mengamankan integritas data historis sehingga item beras lama yang tersimpan di gudang tetap mengenali batch asalnya.

---

## 4. Rekonsiliasi Modul Finansial & Chart of Accounts

- Memastikan konsistensi saldo buku besar (*General Ledger*) pada akun aset persediaan `1-300` (Persediaan Barang) dan kas/bank `1-100` / `1-110`.
- Memperbaiki penanganan `approveTransaction` dan `rejectTransaction` agar jurnal pembalik (*reversal*) membatalkan komitmen saldo secara tepat tanpa kebocoran data antar-sesi.

---

## 5. Logika, Aturan Bisnis, Rumus, dan Perhitungan Lengkap Finance Center

Bagian ini merupakan panduan lengkap mengenai cara kerja, logika kalkulasi, dan formula matematis yang mendasari seluruh metrik di **Finance Center**.

### A. Struktur Bagan Akun (Chart of Accounts - CoA) & Aturan Saldo Normal
Finance Center menggunakan sistem pembukuan berpasangan (*Double-Entry Bookkeeping*) dengan 12 akun standar:

| Kode Akun | Nama Akun | Kategori | Saldo Normal | Penjelasan Operasional |
| :--- | :--- | :--- | :---: | :--- |
| **1-100** | Kas Utama | `ASSET` | **Debit** | Uang tunai fisik yang dipegang kasir/brankas pabrik |
| **1-110** | Bank Operasional | `ASSET` | **Debit** | Saldo rekening bank resmi operasional pabrik |
| **1-200** | Piutang Usaha (AR) | `ASSET` | **Debit** | Hak penagihan atas penjualan beras bertempo (belum lunas) |
| **1-300** | Persediaan Barang | `ASSET` | **Debit** | Nilai buku persediaan gabah dan beras di gudang |
| **2-100** | Hutang Usaha (AP) | `LIABILITY` | **Kredit** | Kewajiban pembayaran belanja gabah ke petani/supplier |
| **2-200** | Titipan Dana | `LIABILITY` | **Kredit** | Dana titipan pihak ketiga / hutang lancar lainnya |
| **3-100** | Modal Pemilik | `EQUITY` | **Kredit** | Modal setor awal dari pemilik pabrik |
| **3-200** | Laba Ditahan | `EQUITY` | **Kredit** | Akumulasi laba bersih operasional periode-periode lalu |
| **4-100** | Penjualan Beras | `REVENUE` | **Kredit** | Pendapatan kotor dari penjualan beras & produk sampingan |
| **4-300** | Retur Penjualan | `REVENUE` | **Debit** | Pengurang penjualan akibat pengembalian barang |
| **5-100** | HPP (Beban Pokok) | `EXPENSE` | **Debit** | Nilai modal gabah/beras yang sudah keluar karena terjual |
| **5-200** | Beban Operasional | `EXPENSE` | **Debit** | Biaya operasional (upah kuli, solar, logistik, listrik) |

**Aturan Matematis Saldo Buku Besar:**
- **Untuk Akun Golongan `ASSET` dan `EXPENSE`:**
  $$\text{Saldo Akhir} = \sum \text{Debit} - \sum \text{Kredit}$$
- **Untuk Akun Golongan `LIABILITY`, `EQUITY`, dan `REVENUE`:**
  $$\text{Saldo Akhir} = \sum \text{Kredit} - \sum \text{Debit}$$

---

### B. Siklus Transaksi & Aturan Persetujuan (Approval Workflow)
Setiap transaksi keuangan melewati status persetujuan yang ketat:
1. **`PENDING` (Menunggu Persetujuan):**
   - Dibuat otomatis saat operator mencatat belanja gabah, biaya logistik, ongkos jemur, atau biaya giling.
   - Pada status ini, saldo kas riil pabrik **belum terpotong**.
   - Sistem mencatat nilai ini ke dalam **`pending_balance`** (saldo proyeksi) untuk memantau komitmen dana yang akan keluar.
2. **`APPROVED` (Disetujui):**
   - Disetujui oleh Manajer Keuangan / Admin di menu *Approval Transaksi*.
   - Manajer Keuangan memilih akun sumber dana (misal: *Kas Utama 1-100* atau *Bank 1-110*).
   - Baris kredit kas terbentuk, dan nilai transaksi resmi masuk ke dalam **`committed_balance`** (saldo riil buku besar).
3. **`REJECTED` (Ditolak):**
   - Jurnal dibatalkan secara permanen tanpa pernah menyentuh atau memotong kas pabrik.

---

### C. Rumus dan Perhitungan Laporan Laba Rugi (Income Statement / P&L)
Perhitungan performa laba rugi dihitung secara dinamis sesuai rentang tanggal yang dipilih (*Hari Ini, 7 Hari, 30 Hari, atau Rentang Kustom*):

#### 1. Revenue (Penjualan Bersih)
$$\text{Revenue} = \sum \text{Penjualan Beras \& Produk (4-100)} - \sum \text{Retur Penjualan (4-300)}$$
*Catatan:* Hanya menghitung nota penjualan aktif (bukan berstatus `VOID` atau `DRAFT`).

#### 2. HPP / COGS (Beban Pokok Penjualan)
$$\text{HPP} = \sum_{\text{seluruh nota terjual}} \Big( \text{Berat Terjual (kg)} \times \text{HPP per kg dari batch/stok terkait} \Big)$$

#### 3. Laba Kotor (Gross Profit)
$$\mathbf{Laba\ Kotor} = \text{Revenue} - \text{HPP}$$
$$\mathbf{Gross\ Margin\ (\%)} = \frac{\text{Laba Kotor}}{\text{Revenue}} \times 100\%$$

#### 4. Total OPEX (Beban Operasional)
$$\text{Total OPEX} = \sum \text{Beban Operasional (5-200)}$$
Mencakup: Biaya logistik transport, biaya upah pengeringan & bahan bakar dryer, biaya karung & upah kuli giling, serta biaya umum pabrik lainnya.

#### 5. Laba Operasional Bersih (Net Operating Profit)
$$\mathbf{Laba\ Operasional} = \text{Laba Kotor} - \text{Total OPEX} = \text{Revenue} - \text{HPP} - \text{Total OPEX}$$
$$\mathbf{Operating\ Margin\ (\%)} = \frac{\text{Laba Operasional}}{\text{Revenue}} \times 100\%$$

#### 6. Modal Kerja (Procurement / Belanja Gabah Periode Terpilih)
$$\text{Modal Belanja Gabah} = \sum \text{Total Harga Pembelian Gabah pada Periode Terpilih}$$
> **Penting (Kaidah Akuntansi):** Belanja gabah adalah **investasi aset lancar (persediaan)**, bukan beban operasional langsung di laporan Laba Rugi. Karena itu, pada dashboard, angka Belanja Gabah disajikan secara terpisah sebagai *Modal Kerja* agar tidak mengurangi laba operasional secara keliru sebelum gabah tersebut digiling dan terjual.

#### 7. Laba Bersih Riil (Net Real Cashflow Profit pada PDF)
$$\text{Laba Bersih Riil} = \text{Laba Operasional} - \text{Modal Belanja Gabah Periode Ini}$$
*Metrik ini menunjukkan sisa uang tunai riil setelah laba operasional dialokasikan untuk membiayai belanja gabah baru pada periode yang sama.*

---

### D. Rumus dan Perhitungan Neraca Keuangan (Balance Sheet)
Neraca menyajikan posisi kekayaan bersih pabrik per detik ini (*Live Balance*):
$$\mathbf{Total\ Aset} = \mathbf{Total\ Kewajiban} + \mathbf{Total\ Ekuitas}$$

#### 1. Aset Lancar (Current Assets):
- **Kas & Setara Kas (`assets.cash`):**
  $$\text{Total Kas} = \sum (\text{Debit} - \text{Kredit}) \text{ pada akun 1-100 dan 1-110 yang APPROVED}$$
- **Piutang Usaha (`assets.receivable` / AR):**
  $$\text{Total Piutang} = \sum (\text{Total Nilai Nota Jual} - \text{Pembayaran yang Telah Diterima})$$
  *(Khusus nota penjualan aktif yang belum lunas / `payment_status != 'PAID'`)*.
- **Persediaan Fisik Gudang (`assets.inventory`):**
  $$\text{Nilai Stok Fisik} = \sum_{\text{item gudang aktif}} \Big( \text{remaining\_weight\_kg} \times \text{avg\_price\_per\_kg} \Big)$$
- **Total Aset:**
  $$\mathbf{Total\ Aset} = \text{Kas} + \text{Piutang (AR)} + \text{Nilai Stok Fisik}$$

#### 2. Kewajiban Lancar (Liabilities):
- **Hutang Usaha (`liabilities.payable` / AP):**
  $$\text{Total Hutang} = \sum (\text{Total Faktur Beli Gabah} - \text{Pembayaran yang Telah Dicicil/Lunas})$$
  *(Khusus pembelian gabah yang belum lunas / `payment_status != 'PAID'`)*.

#### 3. Ekuitas Bersih (Net Worth / Equity):
$$\mathbf{Total\ Ekuitas\ Bersih} = \mathbf{Total\ Aset} - \mathbf{Total\ Kewajiban}$$
*Jika Total Ekuitas bernilai positif, pabrik memiliki fundamental aset yang sehat melampaui seluruh kewajiban hutangnya.*

---

### E. Rumus dan Perhitungan Analisis Margin per Batch
Metrik manajerial untuk mengukur profitabilitas setiap lot produksi gabah:
1. **Biaya Bahan Baku (`rawMaterial`):** $\sum \text{total\_harga}$ seluruh pembelian gabah di batch tersebut.
2. **Biaya Transportasi (`transport`):** $\sum \text{operational\_cost}$ dari modul logistik yang terhubung ke nota pembelian batch.
3. **Biaya Pengeringan (`drying`):** $\sum \text{amount}$ biaya pengeringan dari `trx.drying_costs` batch tersebut.
4. **Biaya Penggilingan (`milling`):** $\sum \text{amount}$ biaya giling dari `trx.process_costs` batch tersebut.
5. **Total Biaya Produksi (COGM):**
   $$\mathbf{Total\ HPP\ (COGM)} = \text{rawMaterial} + \text{transport} + \text{drying} + \text{milling}$$
6. **Revenue Batch (Omset Penjualan):**
   $$\mathbf{Revenue} = \sum \text{subtotal penjualan nota beras yang bersumber dari batch tersebut}$$
7. **Net Margin Batch (Laba/Rugi Bersih Lot):**
   $$\mathbf{Net\ Margin} = \mathbf{Revenue} - \mathbf{Total\ HPP\ (COGM)}$$
   $$\mathbf{Margin\ (\%)} = \frac{\text{Net Margin}}{\text{Revenue}} \times 100\%$$
   - Jika $\text{Net Margin} \ge 0$: Tampil dengan badge warna **Hijau Emerald** (Profit).
   - Jika $\text{Net Margin} < 0$: Tampil dengan badge warna **Merah Rose** (Defisit/Belum tertutup oleh penjualan).

---

### F. Perbedaan Mendasar: CoA 1-300 vs Nilai Stok Fisik Gudang
| Pembeda | Poin 6: Persediaan CoA `1-300` | Poin 7: Nilai Stok Fisik Gudang |
| :--- | :--- | :--- |
| **Sudut Pandang** | Finansial / Akuntansi Buku Besar | Logistik / Operasional Fisik Gudang |
| **Tabel Sumber** | `trx.journal_lines` & `trx.journal_entries` | `trx.inventory_items` |
| **Cara Kerja** | Mencatat akumulasi debet dari pembelian gabah yang telah di-*approve*. | Mengalikan sisa bobot riil gudang $\times$ harga modal per kg (`kg * avg_price`). |
| **Sifat Nilai** | Statis akuntansi (berubah saat tutup buku/jurnal stok). | Sangat dinamis (berkurang detik itu juga saat ada timbangan jual beras keluar gudang). |
| **Sinkronisasi** | Dicocokkan secara berkala melalui proses *Stock Opname* (penyesuaian selisih fisik vs buku besar). |

