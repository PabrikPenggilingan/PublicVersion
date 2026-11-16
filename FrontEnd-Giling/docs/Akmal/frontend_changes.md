# Catatan Perubahan Spesifik (Frontend Layer)

Halo Akmal! Berikut adalah rangkuman dari *diff changeset* teraktual di sisi Frontend yang telah dieksekusi, utamanya untuk merekonstruksi skenario *End-to-End Testing (E2E)* di modul `FinanceDashboard`.

---

## 1. Pemulihan "Parallel Test" di E2E Playwright
**Lokasi File:** `e2e/14-full-accounting-e2e.spec.ts` (Modifikasi Baris ~186 ke bawah)

**Detail Perubahan Kode:**
Sistem telah dikembalikan ke wujud sempurnanya. Blok kode yang awalnya dieksekusi memanjang (sequential) untuk siklus Penjualan dan Pembayaran...

```typescript
// Kondisi Sebelumnya (Sequential Bypass)
await apiReq.payPurchase(cy1.purchaseId, cy1.purchaseTotal);
const saleId1 = await apiReq.sellBeras(cy1.berasId, cy1.outMill, 15000);
await apiReq.paySale(saleId1, cy1.outMill * 15000);
```

Telah ditulis ulang menggunakan arsitektur array `promises`:

```typescript
// Kondisi Sesudahnya (Parallel Stress-Test)
const promises = [];
promises.push((async () => {
  const cy = cycles.find(x => x.c === 1)!;
  await apiReq.payPurchase(cy.purchaseId, cy.purchaseTotal);
  const saleId = await apiReq.sellBeras(cy.berasId, cy.outMill, 15000);
  await apiReq.paySale(saleId, cy.outMill * 15000);
})());
... // (Berlaku untuk 4 cycle lainnya)
await Promise.all(promises);
```

**Alasan Perubahan:** Dengan tertanganinya *bug* kebocoran nomor seri `sale_no` pada arsitektur database backend, kita mengaktifkan ulang `Promise.all` ini untuk mensimulasikan lima pegawai administrasi yang berbeda (Cycle 1 s/d 5) yang secara serentak mengklik tombol "Simpan" di satu waktu yang sama. Hasil pengujian membuktikan tidak ada lagi isu `Duplicate Constraint`.

---

## 2. Perbaikan Endpoint Auto-Approval Jurnal
**Lokasi File:** `e2e/14-full-accounting-e2e.spec.ts` (Modifikasi Baris ~250)

**Detail Perubahan Kode:**
Terdapat anomali pengujian di mana semua asersi angka di layar Finance Dashboard bernilai `Rp 0`. Skrip `14-full-accounting-e2e.spec.ts` secara diam-diam memanggil URL palsu saat mencoba men-*approve* kumpulan jurnal hasil *stress-test*.

```typescript
// Sebelumnya (Metode dan Endpoint salah)
await request.post('/api/finance/approvals', { ... })

// Sesudahnya (Metode PUT & URL Structure benar)
await request.put(`/api/finance/transactions/${j.id}/approve`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { accountId: kasId }
});
```

**Alasan Perubahan:** Memastikan jurnal yang *PENDING* dapat disetujui (*APPROVED*) melalui rute API yang benar (`/transactions/:id/approve`) sehingga rekap angkanya mengalir masuk ke `getBalanceSheet()` untuk diinspeksi oleh Playwright di halaman `/finance`.

---

## 3. Optimasi Kekuatan "XPath Locator" UI Dashboard
**Lokasi File:** `e2e/14-full-accounting-e2e.spec.ts` (Modifikasi Baris ~260)

**Detail Perubahan Kode:**
Teks asersi untuk memvalidasi tagihan API (*Hutang* dan *Piutang*) pada layar Dashboard.

```typescript
// Sebelumnya (Fragile Sibling Selection)
const apText = await page.locator('text=Total Hutang (AP)').locator('xpath=following-sibling::div[1]').first().innerText();

// Sesudahnya (Robust Ancestor Tree Climbing)
const apText = await page.locator('h3:has-text("Total Hutang (AP)")')
        .locator('xpath=ancestor::div[contains(@class, "relative")]')
        .locator('p').first().innerText();
```

**Alasan Perubahan:** Struktur DOM di layar `FinanceDashboard.tsx` sudah dikembangkan jauh lebih kompleks (teks diapit di dalam `<h3>` di dalam `<div class="flex">`, dll). XPath pencarian adik/elemen setelahnya (`following-sibling`) memicu *Timeout*. Penggunaan perintah panjat silsilah elemen (`ancestor`) ke kontainer terluarnya (`relative`) memastikan skrip ini *bulletproof* terhadap bongkar pasang posisi CSS *flexbox* di kemudian hari.

---

## 4. Pembersihan Kode Asersi Usang (Obsolete)
**Lokasi File:** `e2e/14-full-accounting-e2e.spec.ts` (Modifikasi Baris ~280)

**Detail Perubahan Kode:**
Menghapus seluruh blok *expect* berikut:
```typescript
// Dihapus sepenuhnya
const opexTableText = await page.locator('text=Detail Pengeluaran OPEX').locator('..').innerText();
expect(opexTableText).toContain('Beban Logistik');
// ...
```

**Alasan Perubahan:** UI tabel `Detail Pengeluaran OPEX` sudah musnah/dibuang secara desain pada modifikasi UI teraktual di halaman *Finance Center*. Menyimpan asersi ini hanya menyebabkan proses *test run* meledak saat detik ke-240 (*timeout* `locator.innerText`). Pengecekan stabilitas OPEX sudah didelegasikan ke pengecekan angka global *Daily P&L*.
