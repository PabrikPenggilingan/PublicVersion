# Format Laporan Hasil AI Analysis Bulanan (AERP)

Dokumen ini menjelaskan format dan struktur laporan analisis bulanan yang dihasilkan oleh AI untuk sistem AERP (Gilingan Padi). Laporan ini dirancang untuk memberikan wawasan mendalam kepada manajemen mengenai performa operasional, efisiensi produksi, dan kesehatan keuangan.

---

## 1. Struktur Laporan (Markdown Format)

### I. Ringkasan Eksekutif (Executive Summary)
*Berisi rangkuman performa bulan ini dibandingkan bulan sebelumnya.*
- **Total Revenue:** Rp XXX.XXX.XXX (📈/📉 X%)
- **Estimasi Profit Bersih:** Rp XXX.XXX.XXX
- **Total Produksi (Beras):** XXX Kg
- **Rendemen Rata-rata:** XX.X% (Target: >64%)

### II. Analisis Pengadaan Gabah (Purchasing Analysis)
*Menganalisis data dari tabel `purchases` dan `pendataan_gabah`.*
- **Top Supplier/Varietas:** Varietas [Nama] memberikan rendemen tertinggi ([X]%) dengan harga beli rata-rata Rp [X]/kg.
- **Tren Kualitas:** Kadar air rata-rata bulan ini [X]%, naik [X]% dari bulan lalu (indikasi cuaca/musim).
- **Rekomendasi AI:** "Kurangi pembelian dari Calo [Nama] karena kualitas butir rusak sering di atas ambang batas."

### III. Analisis Efisiensi Produksi (Production Efficiency)
*Menganalisis data dari tabel `processes` dan `process_batches`.*
- **Yield Analysis:** Dari total [X] Kg Gabah, dihasilkan [X] Kg Beras Utama dan [X] Kg Sampingan (Dedak, Menir, dll).
- **In-Process Loss:** Terdeteksi penyusutan berat sebesar [X]% pada Batch #[ID].
- **Cost per Kg:** Biaya operasional rata-rata untuk menghasilkan 1kg beras adalah Rp [X].

### IV. Analisis Keuangan & Penjualan (Finance & Sales)
*Menganalisis data dari tabel `sales_beras`, `sales_byproducts`, dan `finance_transactions`.*
- **Profit Margin:** Produk [Beras Premium] memberikan margin tertinggi sebesar [X]%.
- **Cash Flow Health:** Rasio hutang pembelian gabah vs piutang penjualan.
- **Overhead Analysis:** Pengeluaran kategori [Listrik/Solar] membengkak [X]% minggu ke-3.

### V. Prediksi & Rekomendasi Strategis (AI Insights)
*Wawasan prediktif berdasarkan data historis.*
- **Prediksi Stok:** "Stok gabah saat ini akan habis dalam 12 hari berdasarkan kecepatan giling rata-rata."
- **Prediksi Harga:** "Berdasarkan tren tahunan, harga gabah diprediksi naik 5% bulan depan. Disarankan meningkatkan pembelian minggu ini."
- **Alert:** "6 Batch terdeteksi 'Slow Moving' di gudang selama >20 hari."

---

## 2. Strategi Ekstraksi Data (Technical Logic)

Untuk menghasilkan laporan di atas, AI perlu mengakses data berikut:

| Bagian | Sumber Data (Table) | Metrik Utama |
| :--- | :--- | :--- |
| **Purchasing** | `trx.purchases`, `trx.pendataan_gabah` | `kadar_air`, `kadar_hampa`, `harga_per_kg` |
| **Production** | `trx.processes`, `trx.process_batches` | `total_input_kg`, `durasi_proses` |
| **Sales** | `trx.sales_beras`, `trx.sales_dedak`, dll | `tonase`, `harga_jual_total`, `rendemen` |
| **Finance** | `trx.finance_transactions`, `trx.overhead_expenses` | `amount`, `category`, `account_balance` |

---

## 3. Contoh Output JSON (Untuk Integrasi API)

Jika AI diintegrasikan ke sistem, format data mentah yang disarankan:

```json
{
  "report_period": "Mei 2026",
  "kpis": {
    "total_revenue": 540000000,
    "total_cost": 410000000,
    "net_profit": 130000000,
    "avg_rendemen": 64.5
  },
  "insights": [
    {
      "category": "purchasing",
      "level": "warning",
      "message": "Kadar air rata-rata naik ke 18% di minggu terakhir."
    },
    {
      "category": "production",
      "level": "info",
      "message": "Batch #102 memiliki efisiensi giling tertinggi bulan ini."
    }
  ],
  "recommendations": [
    "Prioritaskan pembelian varietas Ciherang dari wilayah X.",
    "Lakukan maintenance mesin giling sebelum tanggal 15 karena beban kerja tinggi."
  ]
}
```

---

## 4. Cara Menjalankan Analisis

1. **Agregasi Data:** Backend menjalankan query bulanan untuk merangkum semua transaksi.
2. **AI Prompting:** Data ringkasan dikirim ke model AI (misal: Gemini/GPT) dengan instruksi khusus untuk mencari anomali dan optimasi.
3. **Penyajian:** Hasil Markdown ditampilkan di Dashboard atau dikirim via Email/WhatsApp kepada pemilik gilingan.
