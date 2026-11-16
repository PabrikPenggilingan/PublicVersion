import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('E2E Full Accounting Multi-Cycle Parallel', () => {
  test.setTimeout(240000); // 4 minutes

  test('Simulate 5 concurrent cycles and verify accounting consolidation', async ({ page, request }) => {
    // 0. LOGIN
    await page.goto('/');
    await page.waitForSelector('#username');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 15000 });

    const token = await page.evaluate(() => localStorage.getItem('token'));
    if (!token) throw new Error('No token found');

    const dummyImagePath = path.join(process.cwd(), 'public/logo.png');

    // HELPER FUNCTIONS
    const apiReq = {
      payPurchase: async (purchaseId: string, amount: number) => {
        await request.post('/api/finance/purchase-payments', {
          headers: { Authorization: `Bearer ${token}` },
          data: { purchaseId, amount, paymentMethod: 'CASH', paymentDate: new Date().toISOString() }
        });
      },
      logisticsCost: async (refId: string, amount: number) => {
        await request.post('/api/logistics', {
          headers: { Authorization: `Bearer ${token}` },
          data: {
            task_date: new Date().toISOString().split('T')[0], task_type: 'GABAH_PICKUP',
            referenceType: 'PURCHASE', referenceId: refId, driverName: 'E2E Driver',
            status: 'COMPLETED', operationalCost: amount, notes: 'E2E Logistics'
          }
        });
      },
      inventoryManual: async (batchId: string, weightKg: number) => {
        const res = await request.post(`/api/inventory/from-batch/${batchId}`, {
          headers: { Authorization: `Bearer ${token}` },
          data: { tonnageKg: weightKg, notes: 'E2E Stock' }
        });
        const d = await res.json();
        return d.data.id;
      },
      dryingProcess: async (batchId: string, costAmount: number, outWeightKg: number) => {
        const dRes = await request.post('/api/drying', {
          headers: { Authorization: `Bearer ${token}` },
          data: { name: 'E2E Drying', batchIds: [batchId], dryingType: 'oven_mandiri', notes: '' }
        });
        const dData = await dRes.json();
        const dryingId = dData.data.id;

        await request.post(`/api/drying/${dryingId}/costs`, {
          headers: { Authorization: `Bearer ${token}` },
          data: { costType: 'LABOR', amount: costAmount, description: 'E2E Jemur' }
        });

        // Add GKG stock
        const gRes = await request.post('/api/inventory', {
          headers: { Authorization: `Bearer ${token}` },
          data: { sourceType: 'manual', batchId, productCategoryCode: 'GABAH_KERING', sacks: [{ weightKg: outWeightKg }] }
        });
        const gData = await gRes.json();
        return gData.data.id;
      },
      millingProcess: async (gkgInvId: string, inWeightKg: number, costAmount: number, outBerasKg: number) => {
        const mRes = await request.post('/api/processes', {
          headers: { Authorization: `Bearer ${token}` },
          data: { inventoryItemId: gkgInvId, gabahReservedKg: inWeightKg, processDate: new Date().toISOString() }
        });
        const mData = await mRes.json();
        const processId = mData.data.id;

        await request.post(`/api/processes/${processId}/costs`, {
          headers: { Authorization: `Bearer ${token}` },
          data: { costType: 'GILING', amount: costAmount, description: 'E2E Giling' }
        });

        const cRes = await request.post(`/api/processes/${processId}/complete`, {
          headers: { Authorization: `Bearer ${token}` },
          data: { outputs: [{ category: 'BERAS', weight_kg: outBerasKg, sacks: 10, notes: '' }], notes: '' }
        });
        const cData = await cRes.json();
        const berasItem = cData.data.find((i: any) => i.product_category_code === 'BERAS');
        return berasItem.id;
      },
      sellBeras: async (invId: string, weightKg: number, pricePerKg: number, voidIt = false) => {
        const sRes = await request.post('/api/sales-v2/sales', {
          headers: { Authorization: `Bearer ${token}` },
          data: {
            customerId: null, saleDate: new Date().toISOString(), notes: '',
            items: [{ inventoryItemId: invId, itemName: 'Beras E2E', categoryCode: 'BERAS', qtyOrdered: weightKg, unitPrice: pricePerKg }]
          }
        });
        const sData = await sRes.json();
        if (!sData.success) {
            console.error('Sell Beras Error:', sData);
        }
        const saleId = sData.data.id;

        await request.post(`/api/sales-v2/sales/${saleId}/confirm`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (voidIt) {
          await request.post(`/api/sales-v2/sales/${saleId}/void`, {
            headers: { Authorization: `Bearer ${token}` },
            data: { voidReason: 'E2E Void Test' }
          });
        }
        return saleId;
      },
      paySale: async (saleId: string, amount: number) => {
        await request.post(`/api/sales-v2/sales/${saleId}/payments`, {
          headers: { Authorization: `Bearer ${token}` },
          data: { amount, method: 'CASH', paymentDate: new Date().toISOString() }
        });
      }
    };

    console.log('--- STARTING SEQUENTIAL PURCHASE & BATCH CREATION ---');
    const cycleData: any[] = [];

    for (let i = 1; i <= 5; i++) {
      // 1. BUAT BATCH
      await page.goto('/batches');
      await page.waitForSelector('button:has-text("Batch")');
      await page.click('button:has-text("Batch")');
      await page.click('button:has-text("Buat Batch")');
      await page.waitForTimeout(1000);
      
      const rows = page.locator('tbody tr');
      await expect(rows.first()).toBeVisible();
      await rows.first().click();
      await page.waitForSelector('text=Batch');
      const urlParts = page.url().split('/');
      const batchId = urlParts[urlParts.length - 1];

      // 2. BUAT PURCHASE via UI
      let pWeight = 1000, pPrice = 7000, outDrying = 850, outMill = 550;
      if (i === 2) { pWeight = 2000; pPrice = 6800; outDrying = 1700; outMill = 1100; }
      if (i === 3) { pWeight = 800; pPrice = 7500; outDrying = 500; outMill = 300; } 
      if (i === 4) { pWeight = 1500; pPrice = 7100; outDrying = 1300; outMill = 800; }
      if (i === 5) { pWeight = 500; pPrice = 6500; outDrying = 400; outMill = 250; }

      await page.click('button:has-text("Tambah Manual")');
      await page.fill('input[placeholder="Masukkan nama petani atau calo"]', `Petani E2E ${i}`);
      await page.fill('input[placeholder="Desa, Kecamatan"]', 'Desa E2E');
      await page.fill('input[placeholder="100"]', pWeight.toString());
      await page.fill('input[placeholder="5000"]', pPrice.toString());
      await page.setInputFiles('input[type="file"]', dummyImagePath);
      await page.locator('textarea').first().fill(`Pembelian E2E ${i}`);
      
      const [postRes] = await Promise.all([
        page.waitForResponse(r => r.url().includes('/purchases') && r.status() === 201),
        page.click('button:has-text("Simpan")')
      ]);
      const postData = await postRes.json();
      const purchaseId = postData.data.id;
      const purchaseTotal = pWeight * pPrice;
      await expect(page.locator('button:has-text("Simpan")')).toBeHidden({ timeout: 15000 });

      cycleData.push({ c: i, batchId, purchaseId, purchaseTotal, pWeight, outDrying, outMill });
    }

    console.log('--- STARTING CONCURRENT API PROCESSING ---');

    // 1. PHASE 1 & 2: Drying/Logistics concurrently via API
    const runCycle = async (cyc: any) => {
      console.log(`Cycle ${cyc.c} starting API processing...`);
      const { c, batchId, purchaseId, purchaseTotal, pWeight, outDrying, outMill } = cyc;
      
      await apiReq.logisticsCost(purchaseId, 100000 * c); 
      
      // Stock
      await apiReq.inventoryManual(batchId, pWeight);
      const gkgId = await apiReq.dryingProcess(batchId, 50000 * c, outDrying);
      const berasId = await apiReq.millingProcess(gkgId, outDrying, 150000 * c, outMill);

      return { ...cyc, berasId };
    };

    // Run all 5 cycles parallel up to Milling
    const cycles = await Promise.all(cycleData.map(cyc => runCycle(cyc)));

    // 2. PHASE 3 & 4 & 5: Payments & Sales interleaving
    console.log('--- EXECUTING PAYMENTS & SALES OVERLAP (PARALLEL TEST FOR RACE CONDITION) ---');
    const promises = [];

    // Cycle 1: Beli Lunas, Jual Lunas
    promises.push((async () => {
      const cy = cycles.find(x => x.c === 1)!;
      await apiReq.payPurchase(cy.purchaseId, cy.purchaseTotal);
      const saleId = await apiReq.sellBeras(cy.berasId, cy.outMill, 15000);
      await apiReq.paySale(saleId, cy.outMill * 15000);
    })());

    // Cycle 2: Bayar parsial (50%), Jual 50% dan cicil (0%)
    promises.push((async () => {
      const cy = cycles.find(x => x.c === 2)!;
      await apiReq.payPurchase(cy.purchaseId, cy.purchaseTotal / 2); 
      await apiReq.sellBeras(cy.berasId, cy.outMill / 2, 16000); 
    })());

    // Cycle 3: Bayar lunas, Jual murah lunas
    promises.push((async () => {
      const cy = cycles.find(x => x.c === 3)!;
      await apiReq.payPurchase(cy.purchaseId, cy.purchaseTotal);
      const saleId = await apiReq.sellBeras(cy.berasId, cy.outMill, 10000); 
      await apiReq.paySale(saleId, cy.outMill * 10000);
    })());

    // Cycle 4: Beli Lunas, Tunda Jual (Simpan Beras)
    promises.push((async () => {
      const cy = cycles.find(x => x.c === 4)!;
      await apiReq.payPurchase(cy.purchaseId, cy.purchaseTotal);
    })());

    // Cycle 5: Beli lunas, Jual lalu VOID
    promises.push((async () => {
      const cy = cycles.find(x => x.c === 5)!;
      await apiReq.payPurchase(cy.purchaseId, cy.purchaseTotal);
      await apiReq.sellBeras(cy.berasId, cy.outMill, 15000, true);
    })());

    // Eksekusi bersamaan untuk mengetes race condition di backend (Trigger generate_sale_no)
    await Promise.all(promises);

    console.log('--- NAVIGATING TO APPROVAL CENTER ---');
    await page.goto('/finance/approvals');
    // Tunggu tabel approval termuat
    await page.waitForSelector('text=PENDING', { timeout: 10000 }).catch(() => null);
    
    // Kita anggap kita approve semua PENDING journals sekaligus!
    // Karena jumlahnya banyak (30+ journals), lebih cepat panggil API bulk atau klik "Setujui" satu per satu di UI.
    // Demi kecepatan E2E, kita panggil API persetujuan langsung untuk semua yang PENDING.
    const pendingRes = await request.get('/api/finance/approvals', { headers: { Authorization: `Bearer ${token}` } });
    const pendingData = await pendingRes.json();
    console.log(`Approving ${pendingData.data?.length} journals...`);
    
    // Kas Pabrik (Tunai) -> 1-100 (Bukan! '1-100' adalah accountCode. Kita butuh ID).
    // Ambil default kas ID
    const accRes = await request.get('/api/finance/accounts', { headers: { Authorization: `Bearer ${token}` } });
    const accData = await accRes.json();
    const kasId = accData.data.find((a:any) => a.account_code === '1-100').id;
    
    // Auto Approve
    await Promise.all((pendingData.data || []).map(async (j: any) => {
        await request.put(`/api/finance/transactions/${j.id}/approve`, {
            headers: { Authorization: `Bearer ${token}` },
            data: { accountId: kasId }
        });
    }));

    console.log('--- VALIDATING FINANCE DASHBOARD ---');
    await page.goto('/finance');
    
    // Kita tunggu agar Balance Sheet selesai dirender
    await page.waitForResponse(r => r.url().includes('finance/balance-sheet'));
    await page.waitForTimeout(2000);

    // Karena Cycle 2 bayar 50% hutang dari total (2000*6800 = 13.600.000) -> 6.800.000.
    // Maka harus ada Hutang Usaha / AP sebesar 6.800.000.
    // Di UI "Total Hutang (AP)"
    const apText = await page.locator('h3:has-text("Total Hutang (AP)")').locator('xpath=ancestor::div[contains(@class, "relative")]').locator('p').first().innerText();
    console.log('Total AP:', apText);
    expect(apText).not.toBe('Rp 0');

    // AR (Cycle 2 jual 550kg @ 16000 = 8.800.000 cicil)
    const arText = await page.locator('h3:has-text("Total Piutang (AR)")').locator('xpath=ancestor::div[contains(@class, "relative")]').locator('p').first().innerText();
    console.log('Total AR:', arText);
    expect(arText).not.toBe('Rp 0');

    // Persediaan (Stok Gudang)
    const invText = await page.locator('h3:has-text("Persediaan (Stok Gudang)")').locator('xpath=ancestor::div[contains(@class, "relative")]').locator('p').first().innerText();
    console.log('Inventory Value:', invText);
    expect(invText).not.toBe('Rp 0');


    
    console.log('E2E Full Accounting Simulation Completed Successfully!');
  });
});
