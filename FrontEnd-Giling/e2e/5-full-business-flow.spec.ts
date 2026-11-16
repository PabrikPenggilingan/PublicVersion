import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Full Business Flow (Procurement -> Milling -> Sales)', () => {
  test.setTimeout(120000); // 2 minutes timeout for full flow

  test('Eksekusi alur penuh', async ({ page }) => {
    // 0. LOGIN
    await page.goto('/');
    await page.waitForSelector('#username');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 15000 });

    // 1. PROCUREMENT (PEMBELIAN GABAH)
    // ===================================
    await page.goto('/batches');
    await expect(page).toHaveURL(/.*batches.*/);
    
    // Buat Batch Baru
    const btnBatchBaru = page.locator('button:has-text("Batch")').first();
    await btnBatchBaru.click();
    
    const btnSubmitBatch = page.locator('button:has-text("Buat Batch")').first();
    await btnSubmitBatch.click();

    // Masuk ke detail batch pertama
    const firstBatchRow = page.locator('tbody tr').first();
    await firstBatchRow.click();
    await expect(page.locator('text=Batch').first()).toBeVisible();

    // Tambah Manual Pembelian
    const btnTambahManual = page.locator('button:has-text("Tambah Manual")').first();
    if (await btnTambahManual.isVisible()) {
      await btnTambahManual.click();

      // Gunakan public/logo.png sebagai dummy image
      const dummyImagePath = path.join(__dirname, '../public/logo.png');
      await page.setInputFiles('input[type="file"]', dummyImagePath);
      
      await page.fill('input[placeholder="Masukkan nama petani atau calo"]', 'Petani E2E Test');
      await page.fill('input[placeholder="Desa, Kecamatan"]', 'Sawah E2E');
      await page.fill('input[placeholder="Contoh: 1500"]', '1000'); // Berat
      await page.fill('input[placeholder="Contoh: 7500"]', '7500'); // Harga
      
      const notes = page.locator('textarea').first();
      await notes.fill('Otomatis E2E');

      await page.click('button:has-text("Simpan")');
      
      // Tunggu hingga modal tertutup
      await expect(page.locator('button:has-text("Simpan")')).toBeHidden({ timeout: 15000 });
    }

    // 2. INVENTORY (STOK MASUK)
    // ===================================
    // Karena Batch belum berstatus CLOSED (perlu Employee Form untuk tutup),
    // Kita tambahkan stok manual ke gudang sebagai representasi gabah yang datang.
    await page.goto('/inventory');
    await expect(page).toHaveURL(/.*inventory.*/);
    
    await page.click('button:has-text("Tambah Item")');
    // Tunggu modal agar ter-render sempurna
    await expect(page.locator('text=Tambah Item Inventory')).toBeVisible({ timeout: 10000 });
    
    // PILIH KATEGORI PERTAMA (Penting karena default state GABAH ditolak DB)
    // Biasanya ini adalah Gabah Kering/Gabah
    await page.locator('.grid.grid-cols-2.gap-2 > button').first().click();
    
    // Karena form ini rumit, kita gunakan placeholder yang ada di form reguler
    await page.locator('input[placeholder="0"]').first().fill('10'); // Jumlah Karung
    await page.locator('input[placeholder="0"]').nth(1).fill('100'); // Berat per Karung
    
    // Dengarkan respon backend saat menyimpan
    page.on('response', async (response) => {
      if (response.url().includes('/api/inventory') && response.request().method() === 'POST') {
        const body = await response.json().catch(() => ({}));
        if (!response.ok() || !body.success) {
          console.error('API Inventory Error:', body);
        }
      }
    });
    
    // Cari tombol simpan yang ada di dalam modal secara presisi
    await page.getByRole('button', { name: 'Simpan', exact: true }).click();
    
    // Tunggu modal tertutup
    await expect(page.locator('text=Tambah Item Inventory')).toBeHidden({ timeout: 15000 });


    // 3. PROCESSING (PENGGILINGAN)
    // ===================================
    await page.goto('/processes');
    await expect(page).toHaveURL(/.*processes.*/);

    await page.click('button:has-text("Proses Baru")');
    await expect(page.locator('text=Buat Proses Giling Baru')).toBeVisible();

    // Pilih gabah dari inventory melalui modal picker
    await page.click('button:has-text("-- Pilih stok gabah --")');
    await expect(page.locator('text=Pilih Gabah untuk Digiling')).toBeVisible();
    
    const firstRadio = page.locator('input[type="radio"]').first();
    if (await firstRadio.isVisible()) {
      // klik memicu onChange yang akan menutup modal
      await firstRadio.click();
      await expect(page.locator('text=Pilih Gabah untuk Digiling')).toBeHidden({ timeout: 15000 });
      
      // Berat (gabahReservedKg) terisi otomatis dari state, tapi kita isi ulang memastikan nilainya valid
      await page.locator('input[type="number"]').first().fill('1000'); 
      await page.click('button:has-text("Mulai Proses")');
      await expect(page.locator('button:has-text("Mulai Proses")')).toBeHidden({ timeout: 15000 });
    } else {
      await page.locator('button:has-text("Tutup")').last().click();
      await page.locator('button:has-text("Batal")').last().click();
    }


    // 4. SALES (PENJUALAN)
    // ===================================
    await page.goto('/sales');
    await expect(page).toHaveURL(/.*sales.*/);

    const btnBuatNota = page.locator('button:has-text("Buat Nota Penjualan")');
    if (await btnBuatNota.isVisible()) {
      await btnBuatNota.click();
      await expect(page).toHaveURL(/.*sales\/.+/, { timeout: 15000 });

      // Cek apakah halaman detail nota muncul
      await expect(page.locator('text=Nota Penjualan').first()).toBeVisible({ timeout: 10000 });
    }
  });
});
