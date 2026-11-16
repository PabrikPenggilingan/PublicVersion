import { test, expect } from '@playwright/test';

test.describe('Processing Flow (Penggilingan)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#username');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 15000 });
  });

  test('harus menampilkan halaman penggilingan', async ({ page }) => {
    // Navigasi langsung ke /processes
    await page.goto('/processes');
    await expect(page).toHaveURL(/.*processes.*/);

    // Memastikan halaman memiliki header "Proses Giling"
    await expect(page.locator('text=Proses Giling').first()).toBeVisible({ timeout: 10000 });
  });
});
