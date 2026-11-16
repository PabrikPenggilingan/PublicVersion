import { test, expect } from '@playwright/test';

test.describe('Approval Center', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/');
    await page.waitForSelector('#username');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 15000 });
  });

  test('menampilkan daftar transaksi pending dan bisa di-approve', async ({ page }) => {
    await page.goto('/finance/approvals');
    
    // Verifikasi ada transaksi pending (dari data seed)
    await expect(page.locator('text=Menunggu Approval')).toBeVisible();
    await expect(page.getByText('Pembayaran Nota Sales UD Makmur [E2E]')).toBeVisible();

    // Pilih opsi akun dari dropdown 
    // Di UI kita cari combobox/select yang pertama 
    const selects = page.locator('select');
    if (await selects.count() > 0) {
      await selects.first().selectOption({ label: 'Kas Pabrik (Tunai)' });
    }

    // Klik tombol approve
    const approveBtn = page.getByRole('button', { name: /Approve/i }).first();
    await expect(approveBtn).toBeEnabled();
    
    // Karena ini E2E, kita mock response backend agar tidak merubah data test yang diandalkan test lain
    // Atau bisa juga biarkan tembus jika test di-isolasi, tapi kita sudah set seed-e2e sebelum test berjalan
    await approveBtn.click();

    // Notifikasi sukses
    await expect(page.getByText(/berhasil/i)).toBeVisible({ timeout: 10000 });
  });

  test('menampilkan empty state jika tidak ada pending transaksi', async ({ page }) => {
    // Kita intercept API backend untuk mengembalikan []
    await page.route('**/api/finance/approvals', async route => {
      const json = {
        success: true,
        data: []
      };
      await route.fulfill({ json });
    });

    await page.goto('/finance/approvals');
    await expect(page.getByText(/Belum ada transaksi yang menunggu/i)).toBeVisible();
  });
});
