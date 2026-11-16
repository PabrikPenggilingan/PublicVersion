import { test, expect } from '@playwright/test';

test.describe('Overhead/OPEX Entry', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/');
    await page.waitForSelector('#username');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 15000 });
  });

  test('catat biaya overhead dan masuk ke Approval Center', async ({ page }) => {
    // Navigasi ke halaman overhead
    await page.goto('/finance/overhead');
    
    // Buka modal tambah biaya
    await page.getByRole('button', { name: /Tambah Biaya/i }).click();

    // Tunggu modal muncul (bisa menggunakan teks judulnya)
    await expect(page.getByText(/Tambah Biaya/i).first()).toBeVisible();

    // Isi form 
    // Cari dropdown kategori dan input teks
    const inputs = page.locator('input');
    
    // Kategori
    await inputs.nth(0).fill('Utilities/Listrik');
    
    // Amount 
    await inputs.nth(1).fill('500000');
    
    // Deskripsi (textarea)
    await page.locator('textarea').fill('Biaya Listrik Pabrik [E2E]');
    
    // Simpan Biaya
    await page.getByRole('button', { name: /Simpan/i }).click();

    // Tunggu modal tertutup dan success toast
    await expect(page.getByRole('button', { name: /Simpan/i })).toBeHidden({ timeout: 10000 });

    // Navigasi ke approval center dan periksa jika overhead baru masuk sebagai pending
    await page.goto('/finance/approvals');
    
    await expect(page.getByText('Biaya Listrik Pabrik [E2E]')).toBeVisible();
    await expect(page.getByText('Rp 500.000')).toBeVisible();
  });
});
