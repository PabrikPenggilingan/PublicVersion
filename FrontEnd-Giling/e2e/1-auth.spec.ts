import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('harus menampilkan pesan error jika login salah', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#username');
    
    await page.fill('#username', 'admin_salah');
    await page.fill('#password', 'password_salah');
    await page.click('button[type="submit"]');

    // Tunggu pesan error muncul (mengandung kata salah atau gagal)
    await expect(page.locator('text=/salah|gagal/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('harus berhasil login dengan kredensial admin', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#username');
    
    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');

    // Harus dialihkan ke halaman dashboard
    await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 15000 });
    
    // Memastikan teks Dashboard terlihat (di Sidebar/Navbar)
    await expect(page.locator('text=Dashboard').first()).toBeVisible({ timeout: 10000 });
  });
});
