# Data Isolation & Consistency Bug Fixes (Backend)
**Date**: September 21, 2026
**Author**: Michael

## Overview
This document logs all the systematic fixes related to data isolation (`created_by` filters) across the system backend, as well as fixing the database logic for Retur / Adjustments and Inventory Delivery triggers.

## Changes Made

### 1. Isolation Fixes
- Added `AsyncLocalStorage` (`requestContext`) via middleware to pass the current user identity globally to models.
- Updated `batchesModel` to only show batches owned by `ctxUser.id` if not an admin.
- Fixed `purchasesModel` similarly to respect `created_by`.
- Isolated `qcModel`, `inventoryItemsModel`, `dryingProcessesModel`, `processesModel`, `customerModel`, and `saleModel` so that they consistently filter based on `created_by`.
- Fixed `dashboard.service.js` to ensure the timeline filters by `userId` to show isolated timelines for each user.

### 2. Retur & Adjustment Fixes (Double Deduction)
- **Problem**: When a user returned physical items (Retur), the system reduced `qty_ordered`, automatically reducing the invoice `subtotal`. However, the Retur service also set `amount_adjusted`, which a database trigger also subtracted, causing a double-deduction (often resulting in negative total balances).
- **Database Constraint**: Modifed `chk_return_amount_positive` in PostgreSQL to allow `amount_adjusted >= 0` instead of `> 0`.
- **Logic Fix**: Changed `salesV2.service.js` to insert `amountAdjusted: 0` for physical returns (so it doesn't double-deduct), while passing the monetary value strictly to the Finance module for proper journal/ledger logging.

### 3. Inventory Deduction & Trigger Fixes
- **Problem (Gabah)**: When Gabah Kering was completely used up in Penggilingan (Milling), its `status` was set to `DEPLETED`, but `remaining_weight_kg` wasn't explicitly zeroed out, causing the remaining weight to still linger in database aggregations.
- **Fix**: Updated `process.service.js` to explicitly set `remainingWeightKg: 0` when Gabah is depleted.
- **Problem (Delivery)**: Creating a Delivery for a sale failed silently/crashed because the PostgreSQL trigger `handle_delivery_item_change` in `056_fix_inventory_column_in_triggers.sql` attempted to insert into `inventory_transactions` using a non-existent column (`quantity_kg` instead of `weight_kg`). 
- **Fix**: Wrote and executed a script to recreate the `handle_delivery_item_change` trigger to properly use `weight_kg`. Deliveries now correctly reduce inventory weight.

- **Problem (Tutup Nota)**: Closing a sale manually set the sale to `COMPLETED`. Completed sales do not hold inventory reservations. Because the logistics module is abandoned, users were clicking `Tutup Nota` without ever recording a Delivery. This dropped the inventory reservation but never actually deducted the physical stock, causing the stock to incorrectly "bounce back" up.
- **Fix**: Replaced the strict delivery validation in `salesV2.service.js`. Now, when `Tutup Nota` is clicked, the system calculates any undelivered items (`qty_ordered - qty_delivered`) and silently auto-creates a Delivery record for the remaining balance. This perfectly syncs the transaction state with physical inventory reduction.

## Future Recommendations
- Do not use database triggers to handle complex interdependent logic across Finance, Inventory, and Sales modules if possible. Shift these side-effects into the Node.js application layer where they can be properly debugged, logged, and isolated.
