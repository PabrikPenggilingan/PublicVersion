import { test, expect } from '@playwright/test';

test.describe('Purchase Flow (Pembelian Gabah)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#username');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 15000 });
  });

  test('harus bisa menavigasi ke daftar pembelian dan membuka form', async ({ page }) => {
    // Navigasi langsung via URL untuk menghindari klik sidebar yang butuh toggle accordion
    await page.goto('/batches');
    await expect(page).toHaveURL(/.*batches.*/);

    // Cari tombol untuk membuat batch baru. Di UI tulisannya "Batch Baru" atau "Buat Batch Pertama"
    const btn = page.locator('button:has-text("Batch")').first();
    await expect(btn).toBeVisible({ timeout: 10000 });
    await btn.click();
    
    // Memastikan modal dengan judul "Buat Batch Baru" terbuka
    await expect(page.locator('text=Buat Batch Baru')).toBeVisible({ timeout: 10000 });
  });
});
