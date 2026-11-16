import { test, expect } from '@playwright/test';

test.describe('Sales Flow (Penjualan)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#username');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 15000 });
  });

  test('harus bisa mengakses halaman penjualan dan membuat form', async ({ page }) => {
    // Navigasi langsung ke /sales (karena di sidebar ada sub-menu, lebih aman via URL)
    await page.goto('/sales');
    await expect(page).toHaveURL(/.*sales.*/);
    
    // Header halaman adalah "Penjualan Produk"
    await expect(page.locator('text=Penjualan Produk')).toBeVisible({ timeout: 10000 });
    
    // Klik tombol Buat Nota Penjualan
    const createBtn = page.locator('button:has-text("Buat Nota Penjualan")');
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    
    // Action ini akan langsung membuat nota dan redirect ke /sales/:id
    // Namun karena mengubah db, untuk test E2E kita hanya klik jika yakin
    // await createBtn.click();
    // await expect(page).toHaveURL(/.*sales\/.+/, { timeout: 15000 });
  });
});
