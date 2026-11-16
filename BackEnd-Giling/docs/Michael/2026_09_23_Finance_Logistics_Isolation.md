# Finance & Logistics Isolation Fixes (Backend)
**Date**: September 23, 2026
**Author**: Michael

## Overview
This document logs the data isolation (`created_by` filters) fixes applied to the Finance Center and Logistics & Transport modules. 

## Changes Made

### 1. Finance Center Isolation Fix (Account Balances)
- **Problem**: `finance.model.js → getAccounts()` computed account balances using SQL CTEs that aggregated all `trx.journal_entries` with no `created_by` filter. The `isAdminOrOwner` variable was computed but never applied inside the CTE SQL. Regular users (TIER_B) saw the entire company's cumulative cash and revenue balances on the Finance Dashboard.
- **Fix**: Added conditional `AND je.created_by = $1` injection into both the `committed` and `pending` CTEs. Param index offsets adjusted accordingly.

### 2. System-wide Owner Bypass Bug
- **Problem**: We discovered that all user accounts in the production database (including regular staff) are currently registered with `role = 'owner'`. Because our data isolation checks globally bypassed isolation for `['admin', 'owner']`, the isolation logic was effectively disabled for everyone. All users could see everyone else's data across Finance, Logistics, and Purchases.
- **Fix**: Changed all isolation bypass conditions from `['admin', 'owner']` to `['admin']` only across 4 files:
  - `finance.service.js` — `buildUserFilter()`
  - `finance.model.js` — `getAccounts()`, `getRecentActivity()`, `getPendingTransactions()`, `getOverheads()`
  - `logistics.model.js` — `findAll()`, `getAvailableReferences()`
  - `purchase.service.js` — purchases list
  
  Now, only the `admin` account bypasses isolation. Every other role, including `owner`, `user`, or `staff`, is properly scoped to their own data.

### 3. Strict Tenancy Enforcement (Admins Isolated)
- **Problem**: Even after restricting the bypass to `admin`, the Finance Center was still shared because multiple accounts were registered as `admin`. In a strict multi-tenant SaaS architecture, even users with the `admin` role should only see data for their own tenant (company).
- **Fix**: Replaced the isolation bypass in `finance.service.js`, `finance.model.js`, `logistics.model.js`, and `purchase.service.js` from `admin` to `super_admin`. Since no user has the `super_admin` role, this effectively turns off the bypass and enforces strict multi-tenancy for everyone, ensuring admins are isolated to their own records.

### 4. Fix 500 Errors in Drying & Process Completion
- **Problem**: Approving a drying process (`/api/drying/:id/approve`) or finalizing a milling process (`/api/processes/:id/complete`) returned a `500 Internal Server Error`.
- **Fix**: 
  - **Drying Service**: Imported the missing `db` module in `drying.service.js`. Updated `drying.controller.js` and `ApproveDryingCommand` to correctly pass the `req.user.id` so the auto-generated journal entries properly respect the new strict data isolation.
  - **Process Service**: Imported the missing `db` module in `process.service.js` which caused a reference error when generating milling cost journal entries.

## Future Recommendations
- Use a single shared `buildUserFilter(alias, startIdx)` helper (already present in `finance.service.js`) across all models to prevent inconsistent role checks.
