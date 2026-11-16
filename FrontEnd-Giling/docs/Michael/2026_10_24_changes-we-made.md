# Sales Revenue Recognition & DRAFT Workflow Refactor (Pengakuan Pendapatan & Alur DRAFT Penjualan)
**Date**: October 24–25, 2026  
**Author**: Michael  

## Overview
This refactor overhauls the sales revenue lifecycle, return mechanics, and payment handling between the Sales module and Finance Center.

Previously:
1. Confirming a sale (`confirmSale`) immediately created an `APPROVED` journal entry (`1-200 Piutang` / `4-100 Pendapatan`) assuming the full order was unpaid AR, regardless of down-payments already received.
2. Returns and adjustments were allowed after confirmation, requiring compensating `SALE_RETURN` journal reversals in the Finance ledger, creating clutter and synchronization problems.
3. In `finance.model.js → getPendingTransactions()`, the query resolving pending cash accounts incorrectly matched Accounts Receivable (`1-200`) because AR had `account_category = 'ASSET'`.

The new flow establishes a clean separation between the **DRAFT negotiation stage** and the **CONFIRMED fulfillment stage**:
- **Returns & Price Adjustments happen during `DRAFT`**: Any item adjustments, returns, or deductions must be settled before confirmation. They directly adjust `sales.total_amount` with zero journal entries created.
- **Payments during `DRAFT` vs Post-Confirmation**: Payments recorded in `DRAFT` (down-payments/DP) do not create a separate journal; they become the cash portion of the sale entry. Payments made after confirmation create standard `PENDING` `SALE_PAYMENT` entries against Piutang.
- **Single `PENDING` Revenue Request on `confirmSale()`**: When confirmed, a single `PENDING` `SALE` request is sent to Finance reflecting the final net amount, automatically splitting into Cash (if DP was paid) and Accounts Receivable (`1-200`) for the unpaid remainder.
- **Fix in Finance Pending Account Detection**: Constrained account filtering from generic `'ASSET'` to Cash & Bank accounts (`1-1%`), ensuring `pending_account_id` never accidentally picks up AR (`1-200`).

---

## Business Decisions & Architecture Rules

1. **Pre-Confirmation Adjustments (DRAFT Only)**:
   - Returns (`ReturnService.create()` and `delete()`) are strictly restricted to `sale.status === 'DRAFT'`.
   - Once a sale is confirmed, the product quantities and monetary total are frozen.
   - Eliminates `SALE_RETURN` journal reversals entirely; `total_amount` at confirmation already represents the true net figure.

2. **Unified Revenue Recognition on Confirmation**:
   - `confirmSale()` sends a `PENDING` journal entry to Finance:
     - **Credit**: `4-100 Pendapatan Penjualan` for `finalAmount` (`confirmedSale.total_amount`).
     - **Debit (Cash)**: `{ accountId: null, debit: paidAmount }` if down-payments were recorded during `DRAFT`. Finance chooses the destination cash/bank account upon approval.
     - **Debit (AR / Piutang)**: `{ accountId: 1-200, debit: outstandingAmount }` for any remaining unpaid balance.
   - If a sale is 100% paid upfront during `DRAFT`, Piutang is `0` and only Cash Debit is booked.
   - If unpaid, 100% goes to Piutang.

3. **Down-Payment Protection**:
   - Payments recorded during `DRAFT` cannot be deleted once the note is confirmed (`PaymentService.delete()` throws `BusinessRuleError`) because their value was already factored into the `SALE` journal sent to Finance.

4. **Post-Confirmation Payments**:
   - Payments added after confirmation (`status !== 'DRAFT'`) generate their own `PENDING` `SALE_PAYMENT` journal entry (DR Cash / CR AR `1-200`) to pay off the outstanding receivable.

5. **Tutup Penjualan (Closure)**:
   - Sale closure simply closes the note (`COMPLETED`) and fulfills any undelivered items via auto-delivery. Revenue has already been submitted during confirmation, so no additional revenue journal is triggered at close.

---

## Changes Made

### 1. Backend

#### A. `backend/src/models/finance.model.js`
- **`getPendingTransactions()`**:
  - Changed the pending account resolution subquery:
    ```sql
    -- Before:
    WHERE jl.journal_id = j.id AND (fa.account_type IN ('CASH', 'BANK') OR fa.account_category = 'ASSET')
    
    -- After:
    WHERE jl.journal_id = j.id AND (fa.account_type IN ('CASH', 'BANK') OR fa.account_code LIKE '1-1%')
    ```
  - **Reason**: Accounts Receivable (`1-200`) has `account_category = 'ASSET'`. The previous query erroneously selected AR as the `pending_account_id`. Changing to `1-1%` confines selection strictly to Cash and Bank accounts.

#### B. `backend/src/models/saleV2.model.js`
- **`salePaymentModel.create()`**:
  - Added option parameter `{ createJournal = true } = {}`.
  - When `createJournal === false`, records the payment in `trx.sale_payments` and updates `sales.paid_amount` without creating a `SALE_PAYMENT` journal entry.

#### C. `backend/src/services/salesV2.service.js`
- **`SaleService.confirmSale()`**:
  - Resolves account IDs (`1-200` AR and `4-100` Revenue) before updating status.
  - Computes `paidAmount` and `outstandingAmount = finalAmount - paidAmount`.
  - Creates a **`PENDING`** `SALE` journal entry with split debit lines:
    - `{ accountId: null, debit: paidAmount, credit: 0 }` (Pending Cash line, if `paidAmount > 0`)
    - `{ accountId: arId, debit: outstandingAmount, credit: 0 }` (Piutang `1-200`, if `outstandingAmount > 0`)
    - `{ accountId: revId, debit: 0, credit: finalAmount }` (Revenue `4-100`)
- **`PaymentService.create()`**:
  - Passes `{ createJournal: sale.status !== 'DRAFT' }` to `salePaymentModel.create()`. Payments made during `DRAFT` skip journal generation.
- **`PaymentService.delete()`**:
  - Added check verifying whether the payment was made during or before the `SALE` journal creation. If so, throws `BusinessRuleError`: payment is already part of the confirmed revenue entry and cannot be removed.
- **`ReturnService.create()`**:
  - Enforced `if (sale.status !== 'DRAFT') throw new BusinessRuleError('Retur hanya bisa dicatat sebelum nota dikonfirmasi...')`.
  - Removed `SALE_RETURN` journal creation block.
- **`ReturnService.delete()`**:
  - Enforced `if (sale.status !== 'DRAFT') throw new BusinessRuleError('Retur hanya bisa dihapus sebelum nota dikonfirmasi...')`.

---

### 2. Frontend (`FrontEnd-Giling/src/pages/SalesDetail.tsx`)

#### A. Updated Confirmation Dialog & Flow (`handleConfirm`)
- Confirm dialog message displays the exact final net total:
  ```ts
  `Konfirmasi nota ini? Pendapatan final Rp ${parseFloat(sale.total_amount.toString()).toLocaleString('id-ID', ...)} (setelah retur & biaya tambahan) dan biaya transportasi akan dikirim ke Keuangan untuk persetujuan. Retur tidak bisa diubah lagi setelah konfirmasi.`
  ```
- Success toast updated: `"Nota dikonfirmasi, pendapatan & biaya transportasi dikirim ke Keuangan"`.
- Error handling calls `fetchSale()` to refresh UI state in case of concurrent status updates.

#### B. Returns Tab Permission Guard
- Changed `ReturnsPanel` `canAdd` prop to:
  ```tsx
  canAdd={sale.status === 'DRAFT'}
  ```
  Returns can only be added when the note is in `DRAFT`.

#### C. Tutup Penjualan Modal Clean-up
- Cleaned up `CloseModal` warning text to remove mention of revenue forwarding, as revenue is forwarded at confirmation.

---

## How to Test

1. **DRAFT Adjustments & Down-Payment**:
   - Create a new sale in `DRAFT`.
   - Add a return or price adjustment: verify `total_amount` decreases, and **no** journal is created in Finance.
   - Record a partial payment (Down Payment): verify payment is logged, `paid_amount` increases, but **no** `SALE_PAYMENT` request appears in Finance.
2. **Sale Confirmation**:
   - Click **Konfirmasi Nota**.
   - Verify confirmation dialog displays the net total and warns that returns are locked.
   - In Finance Center (`/approval`), verify a single `PENDING` `SALE` request appears:
     - Amount equals total sale amount.
     - Debit lines contain both the Down Payment (Cash) and the outstanding balance (Piutang `1-200`).
     - Credit line contains total revenue (`4-100`).
3. **Approval in Finance**:
   - In Finance Center, approve the `SALE` transaction and select the cash account.
   - Check Finance Ledger: verify Cash, AR, and Revenue accounts are balanced.
4. **Post-Confirmation Payment**:
   - In the confirmed sale, record a payment for the remaining balance.
   - Verify a new `PENDING` `SALE_PAYMENT` request appears in Finance Center.
5. **Guard Verifications**:
   - Attempt to add or delete a return on the confirmed sale: verify action is blocked with error message.
   - Attempt to delete the initial down-payment on the confirmed sale: verify action is blocked.
