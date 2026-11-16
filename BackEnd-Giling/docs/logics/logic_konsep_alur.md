# Alur Konsep (Workflow) Finance & Sistem Penomoran

Dokumen ini memetakan *User Journey* (alur hidup) dari aktivitas operasional pabrik penggilingan mulai dari terciptanya dokumen sampai wujud akhirnya di dalam laci layar **Finance Center (Dashboard)**.

---

## 1. Alur Pintu Masuk Jurnal (Entry Workflow)
Ini adalah cerita tentang siklus pembukuan "Dua Lengan" (*Double-Entry*). Mari ambil contoh proses **Modul Penggilingan (Milling)**:

1. **Aktivitas di Lapangan (Event Triggered):** 
   Mandor pabrik memasukkan biaya perbaikan mesin seharga Rp 2.000.000 pada formulir Modul Penggilingan. Ia menekan tombol "Simpan Biaya".
2. **Pembuatan Lengan Draf (Draft Journaling):** 
   Sistem di belakang (Backend) tidak langsung mengurangi kas perusahaan! Ia membuat catatan rapi (*Journal Entry*) berstatus **PENDING**. 
   - Lengan Kiri (Debit): Beban Giling (`5-400`) naik Rp 2.000.000.
   - Lengan Kanan (Kredit): Sumber uangnya? Masih dikosongkan (`accountId: null`), menanti keputusan bos keuangan.
3. **Area Ruang Tunggu (Approval Center):** 
   Catatan ini melayang menuju daftar antrean di halaman **Approval Center** milik divisi Keuangan. Pada momen ini, nilai Rp 2.000.000 tersebut **tidak** akan dimunculkan di metrik *Total OPEX* pada halaman utama Dashboard.

---

## 2. Alur Resolusi Kas (Approval & Posting Workflow)
Sekarang bola berpindah ke tangan staf/manajer Finance:

4. **Validasi (Finance Review):** 
   Manajer Keuangan membuka *Approval Center*. Dia melihat draf Beban Giling tersebut. Dia menyetujui biayanya dan mengklik *"Approve"*, lalu memilih sumber dana: "Kas Pabrik (Tunai)".
5. **Posting Sistem (HTTP PUT):**
   *Frontend* menembak *endpoint* `PUT /api/finance/transactions/:id/approve` sambil membawa ID "Kas Pabrik".
6. **Eksekusi Lengan Kanan:** 
   Sistem mengisi bagian Lengan Kanan (Kredit) yang kosong tadi dengan ID akun Kas Pabrik, mengubah status dokumen menjadi **APPROVED**, lalu memperbarui saldo kedua akun tersebut secara aktual.
7. **Pendaratan di Dashboard:** 
   Ketika bos melihat halaman Finance Dashboard, sistem (melalui fungsi `getBalanceSheet()`) hanya merangkum saldo dari jurnal-jurnal yang berstatus **APPROVED**. Alhasil, metrik kas tunai menyusut, dan grafik Total Beban Giling / OPEX seketika memerah, menampilkan data yang presisi!

---

## 3. Alur Kelahiran Nomor Nota (Auto-Numbering Workflow)
Jika alur di atas adalah soal uang, alur yang ini adalah soal persuratan (dokumen).

1. **Formulir Terkirim:** Operator menyelesaikan pembuatan nota penjualan beras.
2. **Trigger Mencegat (DB Layer):** Tepat sepersekian milidetik sebelum nota tersimpan di *hard disk* server, *trigger* database `generate_sale_no()` maju menghadang.
3. **Perakitan Prefix:** *Trigger* membedah tanggal input (misal `2026-08-18`). Ia memutuskan bahwa kelompok nota ini bernama `JUAL/2026/08`.
4. **Mengetuk Pintu Tabel Sequence:** *Trigger* mendatangi tabel mandiri `trx.transaction_sequences` untuk melihat ada di urutan berapa grup tersebut bulan ini.
5. **Mengantre & Merakit:** Jika ada rekan *trigger* lain yang sedang mencomot nomor dari grup yang sama, ia akan berdiri menunggu. Jika kosong, ia menyambar nomor seri teratas (misal `005`), menambahkannya (`006`), dan membukanya kuncinya.
6. **Tercetak:** String nomor nota final `JUAL/2026/08/006` distempelkan ke dokumen, dan barulah nota Penjualan Beras tersebut utuh tersimpan di tabel `sales`!
