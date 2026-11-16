import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('QC Margin & P&L', () => {
  test.setTimeout(120000);

  test('validasi kalkulasi Laba Bersih Batch & Laba Bersih Riil', async ({ page }) => {
    // 0. LOGIN
    await page.goto('/');
    await page.waitForSelector('#username');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 15000 });

    // 1. BUAT BATCH BARU
    await page.goto('/batches');
    await page.click('button:has-text("Batch")');
    await page.click('button:has-text("Buat Batch")');
    
    // Masuk ke batch
    await page.locator('tbody tr').first().click();
    await expect(page.locator('text=Batch').first()).toBeVisible();
    
    const urlParts = page.url().split('/');
    const batchId = urlParts[urlParts.length - 1];

    // 2. PEMBELIAN GABAH (1000kg @ 7000 = 7.000.000)
    const btnTambahManual = page.locator('button:has-text("Tambah Manual")').first();
    await btnTambahManual.click();
    await page.fill('input[placeholder="Masukkan nama petani atau calo"]', 'QC Petani');
    await page.fill('input[placeholder="Desa, Kecamatan"]', 'QC Sawah');
    await page.fill('input[placeholder="100"]', '1000'); // Berat 1000
    await page.fill('input[placeholder="5000"]', '7000'); // Harga 7000
    const dummyImagePath = path.join(process.cwd(), 'public/logo.png');
    await page.setInputFiles('input[type="file"]', dummyImagePath);
    await page.locator('textarea').first().fill('Pembelian QC');
    const [postRes] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/purchases') && r.status() === 201),
      page.click('button:has-text("Simpan")')
    ]);
    const postData = await postRes.json();
    const purchaseId = postData.data.id;
    await expect(page.locator('button:has-text("Simpan")')).toBeHidden({ timeout: 15000 });

    // API SEEDING UNTUK LOGISTIK, JEMUR & GILING KARENA BEBERAPA FORM UI COMPLEKS:
    // Kita panggil API langsung untuk mempercepat & memastikan presisi QC
    
    // a. Approve Purchase (No need to GET, we already have ID)
    const token = await page.evaluate(() => localStorage.getItem('token'));
    
    // Logistik (Transport) = 500.000
    const logRes = await page.request.post('/api/logistics', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        task_date: new Date().toISOString().split('T')[0],
        task_type: 'GABAH_PICKUP',
        referenceType: 'PURCHASE',
        referenceId: purchaseId,
        vehicleId: null,
        driverName: 'Pak Supir QC',
        status: 'COMPLETED',
        operationalCost: 500000,
        notes: 'QC Transport'
      }
    });
    console.log('Logistics Cost:', await logRes.json());

    // Tambah Inventory Item
    const invRes = await page.request.post(`/api/inventory/from-batch/${batchId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tonnageKg: 1000,
        notes: 'QC Stok Gabah'
      }
    });
    const invData = await invRes.json();
    const invId = invData.data.id;

    // Drying (Jemur) = 200.000, Susut jadi 850kg
    const dryingRes = await page.request.post('/api/drying', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: 'Drying QC',
        batchIds: [batchId],
        dryingType: 'oven_mandiri',
        notes: 'QC Drying'
      }
    });
    const dryingData = await dryingRes.json();
    console.log('Drying Data:', dryingData);
    const dryingId = dryingData.data.id;
    
    const dryingCostRes = await page.request.post(`/api/drying/${dryingId}/costs`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        costType: 'LABOR',
        amount: 200000,
        description: 'Biaya Jemur QC'
      }
    });
    console.log('Drying Cost:', await dryingCostRes.json());

    // Tambah Stok GKG (Hasil Jemur)
    const gkgRes = await page.request.post('/api/inventory', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        sourceType: 'manual',
        batchId: batchId,
        productCategoryCode: 'GABAH_KERING',
        sacks: [{ weightKg: 850 }],
        notes: 'QC Stok GKG'
      }
    });
    const gkgData = await gkgRes.json();
    console.log('GKG Data:', gkgData);
    const gkgId = gkgData.data.id;

    // Milling (Giling) = 300.000, Susut jadi 550kg Beras
    const millRes = await page.request.post('/api/processes', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        inventoryItemId: gkgId,
        gabahReservedKg: 850,
        processDate: new Date().toISOString(),
        notes: 'QC Milling'
      }
    });
    const millData = await millRes.json();
    console.log('Mill Data:', millData);
    const processId = millData.data.id;

    const millCostRes = await page.request.post(`/api/processes/${processId}/costs`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        costType: 'GILING',
        amount: 300000,
        description: 'Biaya Giling QC'
      }
    });
    console.log('Mill Cost:', await millCostRes.json());

    // Selesaikan Milling dan buat stok Beras otomatis
    const completeRes = await page.request.post(`/api/processes/${processId}/complete`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        outputs: [
          { category: 'BERAS', weight_kg: 550, sacks: 22, notes: 'QC Stok Beras' }
        ],
        notes: 'Selesai Giling QC'
      }
    });
    const completeData = await completeRes.json();
    const berasItem = completeData.data.find((i: any) => i.product_category_code === 'BERAS');
    const berasId = berasItem.id;

    // Sales (Penjualan) = 550kg @ 16.000 = 8.800.000
    const saleRes = await page.request.post('/api/sales-v2/sales', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        customerId: null,
        saleDate: new Date().toISOString(),
        notes: 'QC Sales',
        items: [
          {
            inventoryItemId: berasId,
            itemName: 'Beras Premium QC',
            categoryCode: 'BERAS',
            qtyOrdered: 550,
            unitPrice: 16000
          }
        ]
      }
    });
    const saleData = await saleRes.json();
    if (!saleData.success) {
      console.error('Failed to create sale:', saleData);
    }
    const saleId = saleData.data.id;

    // Confirm Sale agar Revenue terbaca (Status -> CONFIRMED)
    await page.request.post(`/api/sales-v2/sales/${saleId}/confirm`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    // Tunggu sistem melakukan kalkulasi jurnal & PnL (bisa delay sebentar)
    await page.waitForTimeout(2000);

    // 3. VALIDASI FINANCE DASHBOARD
    await page.goto('/finance');
    
    // Tunggu request selesai
    await page.waitForResponse(resp => resp.url().includes('/api/finance/daily-report') && resp.status() === 200);

    // Cek Modal Usaha di UI Dashboard (Teks mungkin -Rp 7.000.000)
    await expect(page.locator('text=-Rp 7.000.000').first()).toBeVisible();

    // Cek Tabel Batch Margin
    const batchRow = page.locator('tbody tr').filter({ hasText: batchId.split('-')[0] });
    // Revenue
    await expect(batchRow.locator('td').nth(3)).toContainText('Rp 8.800.000');
    // HPP Global
    await expect(batchRow.locator('td').nth(4)).toContainText('Rp 8.000.000');
    // Net Margin
    await expect(batchRow.locator('td').nth(5)).toContainText('Rp 800.000');
  });
});
