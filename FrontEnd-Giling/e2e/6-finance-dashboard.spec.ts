import { test, expect } from '@playwright/test';

test.describe('Finance Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/');
    await page.waitForSelector('#username');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 15000 });
  });

  test('menampilkan semua kartu informasi utama', async ({ page }) => {
    await page.goto('/finance');
    
    // Verifikasi header
    await expect(page.locator('h1').filter({ hasText: 'Finance Center' })).toBeVisible();

    // Verifikasi 3 akun dari seed data
    await expect(page.getByText('Kas Pabrik (Tunai)')).toBeVisible();
    await expect(page.getByText('Rekening BCA')).toBeVisible();
    await expect(page.getByText('Rekening Mandiri')).toBeVisible();
    
    // Verifikasi bagian AP/AR
    await expect(page.getByText('Total Hutang (AP)')).toBeVisible();
    await expect(page.getByText('Total Piutang (AR)')).toBeVisible();

    // Verifikasi tombol Approval Center
    const approvalBtn = page.getByRole('button', { name: /Approval Center/i });
    await expect(approvalBtn).toBeVisible();
  });

  test('navigasi ke Approval Center berfungsi', async ({ page }) => {
    await page.goto('/finance');
    await page.getByRole('button', { name: /Approval Center/i }).click();
    await expect(page).toHaveURL(/.*finance\/approvals/);
    await expect(page.getByText('Approval Center')).toBeVisible();
  });
});
