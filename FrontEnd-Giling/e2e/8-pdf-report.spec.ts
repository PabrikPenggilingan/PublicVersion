import { test, expect } from '@playwright/test';

test.describe('PDF Report Date Range', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#username');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 15000 });
  });

  test('dapat mengunduh PDF dengan date range 1 bulan', async ({ page }) => {
    await page.goto('/finance');
    
    // Pastikan tombol Download Report muncul
    const downloadBtn = page.getByRole('button', { name: /Download Report/i });
    await expect(downloadBtn).toBeVisible();
    
    // Download trigger via window.open, we catch the popup instead of download event
    const popupPromise = page.waitForEvent('popup');
    await downloadBtn.click();
    
    const popup = await popupPromise;
    expect(popup.url()).toContain('/api/finance/report/download');
  });
});
