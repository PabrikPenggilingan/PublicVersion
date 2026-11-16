# Frontend Changelog (AIAnalysis vs main)

## 2026-11-15 — AkmalDeploy

Detail lengkap: [docs/Akmal/DOKUMENTASI_PERUBAHAN_2026_11_15.md](docs/Akmal/DOKUMENTASI_PERUBAHAN_2026_11_15.md)

* **Logistik → Pengiriman** per truk (`SaleShipmentModal`) dengan komisi calo per kg.
* **Detail Nota:** potongan customer (Total Diterima bisa dikosongkan & diketik ulang), kartu Arus Uang, tab Transport menampilkan pengiriman.
* **Approval Center:** Bayar/Terima Sekaligus (BKK/BKM) + riwayat bukti kas.
* **Finance:** label HPP/OPEX baru, info biaya produksi & jasa titipan, Rekening hanya kas/bank, transaksi manual per kategori (+ Prive), menu disembunyikan untuk operator/viewer.
* **Pembelian:** total dibayar (harga sampai tempat), input manual admin lewat form share.
* **Proses Giling:** baris bisa diklik, tanggal proses = tanggal belanja. **Pengeringan:** tanggal & nama default dari belanja.

This document summarizes the recent changes and feature additions in the Frontend repository based on the latest commit history.

## 🚀 Features & Enhancements

### Dashboard & Process UI Updates
* **Dashboard Timeline:** Replaced the traditional dashboard layout (Aksi Cepat, Batch Terbaru, Proses Terbaru) with a dynamic visual timeline. The timeline tracks active batches through Belanja Gabah, Pengeringan, Gudang, Penggilingan, Gudang (Beras), and Penjualan phases.
* **Pengeringan Cost Form:** Updated the "Tambah Biaya" modal in Pengeringan. Removed 'Transport' and dynamically added 'Bahan Bakar Pengeringan' and 'Biaya Operator Oven' for oven-based drying methods.
* **Penggilingan Cost UI Redesign:** Redesigned the "Tambah Biaya Produksi" modal in Penggilingan to use a modern toggle-card grid identical to the one in Pengeringan. Replaced the 'Transport' cost option with 'Konsumsi'.
* **Forms Relaxed Validation:** Made non-critical fields (Nama Pekerja, Jumlah Pekerja, Bukti Foto, and Catatan Admin) optional across all data entry forms (`PurchaseForm`, `DryingForm`, `MillingForm`, and Admin's Tambah Manual).
* **Sales Payments Evidence:** Added an optional "Bukti Nota" image upload field with preview functionality in the Sales Payment modal (`SalesDetail.tsx`).
* **Initial Weight Display:** Added visibility of the initial Belanja Gabah weight in the Penggilingan module (both in the gabah picker list and the Input Gabah statistics card) while maintaining dried weight for process calculations.

### UI/UX & Optimizations
* **Build Fix:** Removed unused React imports and replaced deprecated `dark` color palette references with the standardized `stone` palette to resolve staging build errors.
* **Permanent Light Mode & UI Standardization:** Refactored the entire UI color system to permanently adopt the clean, light-mode aesthetic (migrating from legacy inverted themes to standard Tailwind `stone-*` classes). Standardized UI contrast, typography colors, and modal backgrounds across the Dashboard, Logistics, Settings, Inventory, and Approval Center for improved readability and visual consistency.
* **End-to-End Image Compression:** Added a client-side Canvas API utility (`imageCompression.ts`) to progressively resize and compress all image uploads to ≤200KB before reaching the server, applied across all form modules (Batch, Processing, Sales, Purchases).
* **Currency Input Formatting:** Introduced `CurrencyInput` component for live Indonesian currency formatting (e.g., `Rp 1.000.000,00`) across sales and payment modules.
* **Mandatory Field Indicators:** Added red asterisk indicators (`*`) to all mandatory input labels globally (e.g., in Customer creation forms).
* **Silent Data Refreshes:** Improved Finance Center user experience by silently reloading account balances after transaction approvals without requiring manual page refreshes.

### Finance & Accounting
* **Finance Management Module:** Implemented a comprehensive finance module including an accounts dashboard, fund transfers, and manual journal entries.
* **Finance Dashboard:** Added `FinanceDashboard` component for real-time financial tracking, reporting, commissions, and debt management.
* **Gabah Titipan Fees:** Added UI for collecting gabah titipan fees and disabled 'Tambah Stok' on pending titipan.

### Inventory & Logistics
* **Inventory Integration:** Merged open batches into the inventory view and restricted manual gabah insertion.
* **Titipan Management:** Added a titipan filter in Inventory and safeguards to prevent titipan products from entering sales.
* **Gabah Types:** Added `jenis_gabah` (gabah type) tracking to inventory and manual addition forms.

### Processing (Drying & Milling)
* **Drying (Pengeringan):** Implemented `IN_WAREHOUSE` status and locked down the detail view once items enter the warehouse (disabling action buttons, share links, etc.). 
* **Milling (Penggilingan):** Redesigned the milling form link, added dynamic units to the completion modal, and implemented context-aware 'Selesai' status mapping.
* **Process Safeguards:** Enforced gabah selection before selecting drying type, hid dependent fields, and prevented empty gabah from entering the milling process.

### Sales & Purchasing
* **Sales:** Added functionality to remove a sale return, removed 'Pengiriman' from `SalesDetail`, and added safeguards for product quantity, weight, and price selections.
* **Purchasing:** Added purchase form entry, batch summary, and proof of purchase upload functionality.

### New Pages & Tools
* **AI Analysis:** Added a new `AIAnalysis` page for advanced reporting and insights.
* **Community:** Added a Community template and UI components.
* **Testing:** Added an end-to-end test suite and configured Playwright integration.

### Admin & Access Control
* **Master Account Pages:** Created `MasterAccount.tsx` and `MasterPage.tsx` modules to manage users and control module-level access. Admin is securely excluded from the choosable role creation dropdown, and passwords now include a toggleable visibility icon.
* **Dynamic Module Visibility:** Refactored `Sidebar.tsx` to conditionally render module access dynamically based on `user.accessible_modules` instead of legacy privilege tiers. Defaulted empty configs to full module access (except master admin pages) to ensure backward compatibility for legacy owners.

### General System
* **Bug Fixes:**
  * Fixed visibility bug where the "Tutup Penjualan" button remained clickable after a sale reached `COMPLETED` status.
  * Prevented removing/adding returned items on closed sales (`COMPLETED`).
  * Ensured `0` capping for negative financial inputs.
  * Fixed Multi-Tenancy Data Isolation in the Finance module: ensuring that `getDashboard` and `getBalanceSheet` strictly enforce user partitioning so users can only view their own accounts and data.
  * Resolved parameter alias collision bugs in the historical balance sheet calculations for Accounts Receivable (AR) and Accounts Payable (AP).
  * Fixed PDF Nota Penjualan (Sales Receipt) calculation to explicitly list returned item quantities and adjustments as separate rows, and synchronized the PDF `TOTAL AKHIR` to strictly mirror the backend state.
  * Replaced native `window.confirm` dialogues in `ApprovalManager.tsx` (Finance Center) with the custom `confirmDialog` modal for UI consistency.
  * Added `isSubmitting` state safeguard to the Logistics "Jemput Gabah / Antar Barang" modal to prevent duplicate task creation on slow network connections.
* **Refactoring:** Consolidated constants and helpers across the application.

## 🛡️ Security & Hardening
* **Authentication:** Migrated session management to HttpOnly cookies and added Joi schema validation.
* **CSRF Protection:** Injected CSRF headers into submissions.
* **Dependency Hardening:** Updated libraries and dependencies to improve overall security.
* **Error Handling:** Adjusted error messages to prevent spilling crucial system information.

## 🐛 Bug Fixes
* **Sales Receipts:** Updated `pdfGenerator.ts` to properly deduct returned product quantities from the gross sales total and include "Biaya Tambahan" correctly in net total calculations.
* **Inventory Consistency:** Fixed inventory display logic in `InventoryList.tsx` to surface `available_weight_kg` (which factors out active sales reservations) as the primary stock metric to prevent accidental overselling.
* **Location Identification:** Updated the product selection modal in `SalesDetail.tsx` to explicitly display the source location (e.g., "Gudang Utama") alongside the product name for clearer identification of Turunan and Limbah stock.
* Resolved string concatenation bug in Kas totals and synced Ekuitas card design.
* Fixed manual purchase form reload issues, prevented `NaN` submissions, and allowed decimal weights.
* Fixed bug in the drying process where a rejected process couldn't be refilled.
* Fixed calculation for drying shrinkage and hid Pengeringan details from operator (non-admin) users.
* Adjusted alert systems, replacing native alerts with toasts for more consistent notifications.
* Fixed UI bug in Milling process (Proses Giling) where "Biaya Giling" was incorrectly selectable as a valid cost type instead of acting as a disabled placeholder.
* Fixed "Gabah" filter issue in the Inventory side-panel by mapping the generic `GABAH` sidebar tab to query the backend for both `GABAH_BASAH,GABAH_KERING` categories, and correctly appending `OPEN` batches as "Gabah Basah Pribadi".
* Refactored `PurchaseForm.tsx` (Form Belanja Gabah) to use a multi-step batching flow (Phase 1: multiple purchase entries, Phase 2: batch logistics data collection linked to the first purchase item).

## 🛠️ Infrastructure & DevSecOps
* **Docker Build Fix:** Modified multi-stage `Dockerfile` to use `npm install` instead of `npm ci` for the builder stage, effectively preventing strict lockfile synchronization errors (`@types/pako` discrepancy) during container generation.
- Added localStorage persistence for selected accounts in Pending Approval modal, preventing state loss on accidental exit.
- Redesigned Finance Dashboard layout: Posisi Kas & Bank now displays at the top in a wrapped horizontal grid, followed sequentially by Operational P&L, Operating Profit, Ledger Activity, and Batch Margins.
