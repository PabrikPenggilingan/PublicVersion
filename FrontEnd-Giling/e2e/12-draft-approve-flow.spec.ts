import { test, expect } from '@playwright/test';

test.describe('Draft and Approve Complete Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/');
    await page.waitForSelector('#username');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 15000 });
  });

  test('alur lengkap: Catat overhead, muncul di approval, lalu di-approve', async ({ page }) => {
    // 1. Catat overhead
    await page.goto('/finance/overhead');
    await page.getByRole('button', { name: /Tambah Biaya/i }).click();
    await expect(page.getByText(/Tambah Biaya/i).first()).toBeVisible();

    const inputs = page.locator('input');
    await inputs.nth(0).fill('Utilities/Bensin');
    await inputs.nth(1).fill('200000');
    await page.locator('textarea').fill('Biaya Bensin Genset [E2E Flow]');
    
    await page.getByRole('button', { name: /Simpan/i }).click();
    await expect(page.getByRole('button', { name: /Simpan/i })).toBeHidden({ timeout: 10000 });

    // 2. Cek di Approval Center
    await page.goto('/finance/approvals');
    await expect(page.getByText('Biaya Bensin Genset [E2E Flow]')).toBeVisible();

    // 3. Approve transaksi
    const selects = page.locator('select');
    if (await selects.count() > 0) {
      await selects.first().selectOption({ label: 'Kas Pabrik (Tunai)' });
    }

    const approveBtn = page.getByRole('button', { name: /Approve/i }).first();
    await expect(approveBtn).toBeEnabled();
    
    // Klik approve dan verifikasi hilang dari daftar pending
    // Untuk test E2E yang berurutan, pastikan DB di clean ulang oleh global setup
    await approveBtn.click();
    await expect(page.getByText('Biaya Bensin Genset [E2E Flow]')).toBeHidden({ timeout: 10000 });
  });
});
