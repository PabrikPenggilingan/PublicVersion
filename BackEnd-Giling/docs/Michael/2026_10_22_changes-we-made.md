# Batch Purchase Debt (Hutang Pembelian per Batch)
**Date**: October 22, 2026
**Author**: Michael

## Overview
The purchase payment flow was changed from a single "payment request" sent to the Finance Center into a **debt system inside Batch Detail**. The debt is paid in multiple installments (any method) through the same floating payment modal used in Sales. Each installment becomes its own PENDING request in the Finance Center and must be approved manually. Gabah is never blocked by payment status: right after the purchase form is finished, the batch can go to drying.

## Business Decisions
- **Debt = purchases only** (`SUM(trx.purchases.total_harga)`, VOID excluded). Transport cost is **not** part of the debt; it keeps its existing PENDING `LOGISTICS` request created in `completeBatch`.
- **Each installment → PENDING journal** (`BATCH_PAYMENT`: Debit AP 2-100 / Credit cash = assigned on approval). The debt balance updates immediately (same as Sales). If Finance rejects the request, the installment is removed and the debt goes back up.
- **No payment gate** on drying, processing, or inventory transfer (verified: nothing checks `payment_status`).
- **Redirect after transport** to `/batches/:id` only for the batch owner. Other users keep the existing "Batch Pembelian Selesai" summary.
- **Strict multi-tenancy** applies to everything new: debt and payment endpoints only work for the batch owner (`batches.created_by = req.user.id`). Other tenants get `404`. There is no admin/super-admin bypass.

## Changes Made

### 1. Removed the duplicate Finance Center purchase request
- **Problem**: `form.service.js → submitPurchase()` created a **PENDING** `PURCHASE` journal (Inventory 1-300 / AP 2-100) plus an **APPROVED** duplicate a few lines later. The pending one showed up in Pending Requests, and approving it would have counted the purchase twice.
- **Fix**: Removed the PENDING block and kept the APPROVED journal. Migration 092 marks the old pending `PURCHASE` journals as `REJECTED` (27 rows on production when it ran).

### 2. Database — `migrations/092_create_batch_payments.sql`
- New table `trx.batch_payments` (one row per installment, mirrors `trx.sale_payments`): `batch_id, payment_date, amount, payment_method, reference_no, notes, bukti_nota_path, created_by`.
- New column `trx.purchase_payments.batch_payment_id` (FK, `ON DELETE CASCADE`). Each installment is **allocated FIFO** across the batch's unpaid purchases, so `purchases.paid_amount / payment_status`, the AP total on the Finance dashboard, and Debt Manager stay consistent.
- Financial lock-date trigger `trg_lock_batch_payments`. It is guarded with `IF EXISTS` on `sys.check_financial_lock` so the migration doesn't fail on databases where 070 is missing.
- Fully idempotent (`IF NOT EXISTS`, `DROP TRIGGER IF EXISTS`, plus a status-only `UPDATE`), so it is safe for anyone who pulls the project and runs `npm run migrate`.
- **Backfill**: none needed. Debt is computed from purchases, so old batches show as UNPAID, or as PARTIAL/PAID when legacy Debt Manager payments exist (those are counted and listed too).

### 3. Backend
- **New** `src/models/batchPayment.model.js`
  - `getDebt(batchId)` returns `totalOwed, totalPaid, remaining, status (UNPAID/PARTIAL/PAID), payments[]`. Each payment row carries its Finance approval status.
  - `create(batchId, data, userId)` runs in one transaction with `SELECT … FOR UPDATE` on the batch and rejects overpayment (`BusinessRuleError`). It then inserts the installment, allocates FIFO into `purchase_payments`, recalculates the purchases, and creates the PENDING `BATCH_PAYMENT` journal.
  - `deleteWithClient()` and `recalcPurchases()` are used when a request is rejected.
- `finance.model.js → rejectTransaction()`: new `BATCH_PAYMENT` branch that removes the installment and restores the debt. Approval needs no change, because the null cash line gets the chosen account.
- `batch.service.js`: `getOwnedBatch()` (tenant check, 404 for non-owners), `getBatchDebt()`, `createBatchPayment()`.
- `batches.controller.js` and `batch.dto.js`: `getBatchDebt`, `createBatchPayment`, `CreateBatchPaymentCommand`.
- `batches.routes.js`:
  - `GET /api/batches/:id/debt`
  - `POST /api/batches/:id/payments` (multipart, optional `buktiNota`)
- **New** `src/middleware/notaUpload.js`: the bukti-nota multer setup, moved out of `salesV2.routes.js` so Sales and Batch share it. Sales behaviour is unchanged.
- `form.service.js → getBatchSummary()` now returns `canViewBatch` (owner only), and `forms.controller.js` passes `req.user.id`.
- `utils/accounting.map.js`: added a `BATCH_PAYMENT` rule (same as `PURCHASE_PAYMENT`).

### 4. Frontend (`FrontEnd-Giling/src`)
- **New shared components** (extracted from `SalesDetail.tsx`):
  - `components/ui/ModalPortal.tsx`
  - `components/payments/PaymentBadge.tsx`
  - `components/payments/AddPaymentModal.tsx`: takes a `submit` callback, plus optional `title`, `remainingLabel` and `showNotes`.
- `pages/SalesDetail.tsx`: uses the shared components. No behaviour change.
- `pages/BatchDetail.tsx`: new **Hutang Pembelian** section with these parts:
  - stat cards for Total Hutang, Sudah Dibayar and Sisa Hutang, plus the status badge
  - a payment history table (date, amount, method, reference, notes, *Menunggu Approval / Disetujui*)
  - a **Bayar Hutang** button that opens the shared modal, capped at the remaining debt
  - its own loading and error states with retry, so a debt failure doesn't break the page
- `pages/form/PurchaseForm.tsx`: after transport is submitted, the owner is redirected to Batch Detail with a toast.
- `api/client.ts`: `batchesAPI.getDebt`, `batchesAPI.createPayment`, the `BatchDebt` / `BatchDebtPayment` / `PaymentInput` types, and `BatchSummary.canViewBatch`.
- `pages/ApprovalManager.tsx` and `pages/FinanceLedger.tsx`: `BATCH_PAYMENT` labels ("Bayar Hutang Batch").

### 5. Docker: stale frontend bundle fix (`FrontEnd-Giling/Dockerfile`)
- **Problem**: `docker-compose.yml` mounts the named volume `frontend_dist` over `/usr/share/nginx/html` (shared with `gabah_nginx`). Docker only seeds a named volume from the image **the first time it is created**. Every later `docker compose up --build` therefore kept serving the old bundle; on this machine it was from 2026-08-31. None of the new frontend code (redirect, debt section) was visible on `http://localhost`.
- **Fix**: The image keeps the build in `/opt/dist`. On container start it wipes `/usr/share/nginx/html` and copies `/opt/dist` into it before starting nginx. Rebuilding the frontend image now always updates what nginx serves. It still works without a volume (plain deploy).
- **Note**: the API container mounts `BackEnd-Giling/backend` as `/app` but runs `npm start` (no watcher), so restart it after backend changes: `docker restart gabah_api`.

## How to Test
1. `npm run migrate` in `backend-giling/backend` (already applied on production on 2026-10-22).
2. Submit purchases through the form link. **No** new PURCHASE request appears in Pending Requests.
3. Finish transport as the batch owner. You are redirected to Batch Detail and the debt shows UNPAID.
4. Before paying, check that the batch can be selected for drying.
5. Pay part of the debt. The status becomes PARTIAL, and a `BATCH_PAYMENT` request appears in Pending Requests. Overpaying is blocked by the client and the server.
6. Approve the request (choose an account). The row becomes *Disetujui*. Pay the rest and the status becomes PAID. Reject one payment and the debt goes back up.
7. Log in as another tenant and open `/api/batches/<id>/debt`. It returns `404`.
8. Sales payments still work (shared modal).

## Known Issues (not changed)
- `finance.service.js → recordPurchasePayment(data, userId)` is called with one argument from the controller, and the DTO uses `accountId` instead of `financeAccountId`. So legacy Debt Manager payments lose `created_by` and the chosen cash account.

---

# Batch Margin Analysis (Analisis Margin per Batch) — Unit Economics
**Date**: October 22, 2026
**Author**: Michael

## Overview
The **Analisis Margin per Batch** table on the Finance Dashboard used to show `Revenue − Total HPP` for each batch. It charged the whole cost pool against whatever had sold so far, so a half-sold batch looked like a big loss, and it ignored kilograms entirely. It now follows per-kg unit economics:

| Metric | Formula |
|---|---|
| **Total Cost** (COGS pool) | gabah purchases + purchase transport + drying costs + milling costs |
| **Unit Cost** (HPP/kg) | Total Cost / beras obtained (kg) |
| **Unit Revenue** (Revenue/kg) | beras sales income / beras sold (kg) |
| **Unit Margin** (Margin/kg) | Unit Revenue − Unit Cost |
| **Total Profit** | Unit Margin × beras sold (kg) |

## Business Decisions
- **Beras only.** Revenue and kg sold count only `sale_items.category_code = 'BERAS'`, because beras is the main income. Sales of by-products (dedak, menir, sekam) are not included for now.
- **Cost pool = everything spent until beras is obtained.** That means all purchase, purchase-transport, drying and milling cost types, including `TRANSPORT`/`OTHER` cost lines inside drying and milling. **Sales transport is excluded** (`logistics_tasks.reference_type = 'SALE'`).
- **Sold kg uses `qty_delivered`**, not `qty_ordered`. SACK lines are converted with `inventory_items.packaging_size_kg`. Revenue = `unit_price × qty_delivered`. Sales with status `VOID` or `DRAFT` are excluded.
- **Returns:** no extra adjustment. Recording a return (`saleV2.model.js → createReturn`) already reduces `sale_items.qty_ordered/qty_delivered`. Subtracting `sale_returns` again counted it twice and produced negative kg sold on production data, so that was removed.
- **Not computable = `null` (shown as "—").** Unit Cost is `null` until beras has been milled. Unit Revenue, Margin and Total Profit are `null` until beras has been delivered.
- **Strict multi-tenancy.** Both margin endpoints previously returned **every tenant's** batches. They are now scoped to `batches.created_by = req.user.id`, and the single-batch report returns `404` for other tenants' IDs.

## Changes Made

### 1. Backend — `src/services/batch.service.js`
- `getBatchMarginReport(batchId, userId)` and `getAllBatchMarginReports(userId, limit)` now share one query, `_queryMarginReports()`.
- **Ownership:** `batch_list` filters by `created_by = $1`. The single report first calls `getOwnedBatch()`.
- **Double counting fixed:** a new `process_batch` CTE assigns each milling process to exactly one batch (its input stock's batch, otherwise its earliest `process_batches` link). Before, the `OR` join on `process_batches` could add a process's costs and sales to the same batch more than once.
- New per-batch aggregates:
  - `riceObtainedKg`: `SUM(total_weight_kg)` of milling outputs (`source_type = 'process'`, `product_category_code = 'BERAS'`). This matches the HPP calculation in `process.service.js`.
  - `riceSoldKg` and `riceRevenue`: from the BERAS sale lines.
- Response `financials` is now: `costs { rawMaterial, transport, drying, milling, total }, riceObtainedKg, riceSoldKg, riceRevenue, unitCost, unitRevenue, unitMargin, totalProfit`. The old `revenue` and `netMargin` fields were removed; `FinanceDashboard.tsx` was their only consumer.

### 2. Backend — `src/controllers/batches.controller.js`
- Both margin handlers pass `req.user.id` to the service.

### 3. Frontend — `FrontEnd-Giling/src/pages/FinanceDashboard.tsx`
- The table columns are now: ID Batch · Tanggal · Jenis · Total Biaya · Beras Diperoleh · HPP/kg · Beras Terjual · Revenue/kg · Margin/kg · **Total Profit**. Margin/kg and Total Profit are green or red by sign.
- New helpers: `formatOptionalCurrency()` shows "—" for `null`, and `formatKg()` formats weights. The table's minimum width went up to 1200px, and it scrolls horizontally on small screens.

## Verification (production DB, read-only, 2026-10-22)
- The query ran for the 5 tenants that own batches, in 25–55 ms each. No row belonged to another tenant. The single-batch report matched the list. A foreign user ID got `NotFoundError`.
- Sample `f50d0af9`: cost Rp19,998,002, 5,050 kg obtained, so HPP Rp3,960/kg. It sold 1,400 kg at Rp14,000/kg, so the margin is Rp10,040/kg and Total Profit ≈ Rp14,056,000.

## How to Test
1. Restart the API (`docker restart gabah_api`) and rebuild the frontend so nginx serves the new bundle.
2. Open the Finance Dashboard and scroll to **Analisis Margin per Batch**. Only your own batches are listed, with the 10 new columns.
3. Batch with purchases only (not milled): Total Biaya is filled, Beras Diperoleh is 0 kg, and HPP/kg through Total Profit show "—".
4. Complete milling with a BERAS output. Beras Diperoleh = the output weight and HPP/kg = Total Biaya / kg. Add a milling or drying cost (`TRANSPORT` too) and Total Biaya and HPP/kg go up.
5. Create a BERAS sale and confirm it **without** a delivery. Beras Terjual stays 0 kg. Record a delivery and Beras Terjual = the delivered kg, Revenue/kg = the price, and Total Profit = Margin/kg × kg.
6. Add a sale-transport logistics task. Total Biaya does **not** change.
7. Sell dedak/menir from the same batch. Revenue/kg and kg sold do **not** change.
8. Record a return on a delivered BERAS line. Kg sold goes down by the returned qty (once, never negative).
9. VOID the sale. Its kg and revenue disappear from the batch.
10. Log in as another tenant: the dashboard doesn't list the first tenant's batches, and `GET /api/batches/<their id>/margin-report` returns `404`.

## Known Issues (not changed)
- **`qty_delivered` is mostly 0 in production.** 20 of the 22 BERAS sale lines (including COMPLETED sales) have no delivery recorded in `sale_delivery_items`. Those batches show "—" for Revenue/kg and Total Profit until deliveries are recorded.
- **Sale-level price reductions** (`sale_returns` with `sale_item_id IS NULL`) cannot be assigned to a batch, so they are not deducted from revenue.
- A SACK line whose inventory item has no `packaging_size_kg` counts as 0 kg.
- Drying costs are still assigned per `drying_batches` link. If one drying process is linked to several batches, each batch gets the full drying cost.
