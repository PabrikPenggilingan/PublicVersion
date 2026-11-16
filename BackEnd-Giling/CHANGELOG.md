# Backend Changelog (MikelTestCompose vs main)

## 2026-11-15 — AkmalDeploy (migration 095–100)

Detail lengkap: [docs/Akmal/DOKUMENTASI_PERUBAHAN_2026_11_15.md](docs/Akmal/DOKUMENTASI_PERUBAHAN_2026_11_15.md)

* **Pembelian:** harga sampai tempat (`total_dibayar`), selisih jadi transport.
* **Pengiriman per truk:** banyak nota per truk, transport (5-200) & komisi calo per kg (5-500) sebagai jurnal PENDING; ongkir customer dihapus.
* **Potongan customer per nota:** beban 5-700, mengurangi piutang; status lunas memperhitungkan potongan.
* **Bukti kas BKK/BKM:** bayar/terima beberapa transaksi tertunda sekaligus.
* **Finance Center:** perbaikan transaksi manual, piutang, nota/biaya yang ditolak, double counting OPEX (biaya produksi hanya lewat HPP), PDF overhead, rekening tanpa kategori, jurnal pembalik tanpa pemilik, pendapatan jasa titipan.
* **Data per pabrik:** `sys.users.owner_id`; semua modul memfilter per pabrik; Finance diblok untuk operator/viewer.
* **UX:** `belanja_date` pada daftar pengeringan; `driver_name` pengiriman opsional.

This document summarizes the recent changes and architectural updates in the Backend repository based on the latest commit history.

## 🚀 Features & Enhancements

### Dashboard & Process Enhancements
* **Dashboard Timeline API:** Overhauled the dashboard timeline endpoint to support an interactive visual phase-tracking layout (from Belanja Gabah to Penjualan).
* **Pendataan Gabah Privacy:** Implemented role-based row-level filtering in Pendataan Gabah (`pendataanGabah.model.js`) ensuring non-admin users only see their own gabah batches.
* **Process Cost Expansion:** Added `OVEN_FUEL` and `OVEN_OPERATOR` cost types to `trx.drying_costs` to accommodate oven-based drying methods. Also added `KONSUMSI` cost type to `trx.process_costs` for milling processes.
* **Sales Payments Evidence:** Added support for optional `bukti_nota_path` image uploads on Sales Payments (routes updated with multer, DTOs, and controllers adjusted).
* **Initial Weight Tracking:** Updated `inventoryItems` and `processes` queries to pass along `total_qty_kg` from `trx.batches` as the initial weight, providing historical reference of the original gabah weight before shrinkage.

### Security & Optimizations
* **Server-side Image Compression Middleware:** Added `compressImage.middleware.js` using `sharp` as a fallback to aggressively compress any image over 200KB (resizes to 1920px max and scales down quality iteratively). 
* **Compression Integration:** Applied the compression middleware to all core upload routes (`/files` and `/purchases/:id/photos`).

### Finance & Accounting
* **Finance Module:** Implemented a comprehensive finance module with controllers, routes, and services for internal fund transfers, manual transaction management, and financial reporting.
* **Accounting Rules Engine:** Added a rules engine for accounting management and automated ledger logic (e.g., classifying ASSET debits as IN and credits as OUT).
* **Workflows:** Implemented transaction approval workflows and integrated gabah titipan fees to the approval center.
* **Finance Bug Fixes:** Fixed transaction type mapping in `finance.model.js` (corrected `'SALES'` to `'SALE'`) to ensure proper `IN`/`OUT` transaction signs for Sales journals.

### Inventory & Sales
* **Inventory Management System:** Added controllers, services, and models for tracking stock, sacks, and weight-based operations.
* **Sales Tracking:** Implemented modular backend services for sales processing and added functionality to remove a sale return.
* **Drying Status:** Automated transition of drying status to `IN_WAREHOUSE` on successful transfer.

### Architecture & Refactoring
* **Standardized Data Layer:** Standardized data layer with DTO (Data Transfer Object) commands and response mappers for sales, inventory, processing, and drying.
* **Form Architecture:** Standardized the architecture of the forms module.

### Admin & Access Control
* **Master Account Management:** Created `MasterAccount` endpoints and logic (`users.routes.js`, `users.controller.js`, `usersModel.js`) to allow admins to create new Owner/Operator/Viewer accounts and assign `accessible_modules`.
* **Data Privacy & Isolation:** Created a backend script (`link_data_to_admin.js`) that links all unassigned historical data (`trx.inventory_items`, `trx.sales`, `trx.processes`, `trx.purchases`, `trx.batches`, `trx.finance_transactions`) to the primary Admin account for cross-tenant privacy enforcement.

## 🛡️ Security & Hardening
* **Role-Based Access Control (RBAC):** Set up restricted runtime user roles with CRUD-only privileges in the database. Aligned admin and operator access to enforce accountability.
* **IDOR Prevention:** Centralized Insecure Direct Object Reference (IDOR) ownership checks into a reusable `authGuards` helper. Added parent ownership and foreign key validations.
* **Rate Limiting & Traffic Control:** Implemented global and auth rate limiting via `express-rate-limit`. Limited CRUD operations and JSON payloads to 100kb.
* **Protection Mechanisms:** Integrated HPP (HTTP Parameter Pollution) middleware, implemented non-predictable CSRF tokens, and enforced strict cookie boundaries.
* **Headers & CORS:** Locked down CORS to explicitly allowed origins via environment variables and configured Content Security Policy (CSP) headers using Helmet.
* **Session Management:** Migrated session management to HttpOnly cookies and added Joi schema validation.
* **Validation:** Added strict validation to inventory, finance, and sales using `validator.js`.
* **Auditing & Logging:** Integrated pre-build dependency vulnerability scanning, activated localized transaction logging, and updated dependencies for hardening.

## 🐛 Bug Fixes
* **Retur & Inventory Logic:** Fixed 'phantom inventory' and double-deduction bugs during sales returns. The system now intelligently calculates `physicalReturnQty` to only restock goods that were actually delivered, while properly reducing `qty_ordered` to instantly free up reservations.
* **Sales Return Financials:** Fixed financial deductions for physical returns by updating `sync_sale_subtotal` to automatically adjust the total based on reduced `qty_ordered`.
* **Dashboard Timeline:** Fixed timeline tracking to properly track the pengeringan phase and accurately map gabah states instead of being stuck in the belanja state.
* **Inventory Deduction:** Removed duplicate manual inventory deduction loop in `salesV2.service.confirm()`, relying entirely on dynamic `sale_reserved_kg` and physical delivery triggers.
* Resolved process completion errors by properly calculating `totalOutputKg` and relaxing max duration constraints (to 3 days).
* Corrected `logsService` imports and formats in inventory.
* Scoped `wasteKg` payload correctly in `submitEndSession` to resolve `ReferenceError`.
* Reverted `PurchaseResponseDTO` to use `snake_case` for frontend compatibility.
* Corrected `dryingType` validation enum.
* Gracefully handled runtime exceptions to prevent server crashes.
* Fixed manual purchase creation validation to allow optional `nama`, `calo`, and `lokasiBelanja`.
* Added automatic `PENDING` journal entry creation for purchases and logistics submitted via Form Belanja Gabah to correctly reflect in the Financial Center.

## 🛠️ Infrastructure & DevSecOps
* **Full-Stack Dockerization:** Containerized the React frontend (`FrontEnd-Giling`) and integrated it into the existing `docker-compose.yml` so the entire application stack (DB + API + Frontend + NGINX) can be started with a single `docker-compose up -d --build`:
  * Added `Dockerfile` to `FrontEnd-Giling` using a multi-stage build: Node.js builds the React/Vite app, NGINX serves the static output (~20MB final image).
  * Added `nginx.conf` to `FrontEnd-Giling` for SPA routing and aggressive static asset caching.
  * Added `frontend` service to `docker-compose.yml` using a shared `frontend_dist` Docker volume to pass built files to the main NGINX container.
  * Updated `nginx/conf.d/default.conf` to serve the frontend static files and add proper caching headers.
  * Updated `.dockerignore` in `FrontEnd-Giling` to exclude test artifacts, scratch files, and build output.
  * Created `ABOUT_DOCKERIZE.md` in both repos with full architecture documentation.
* **Local Development Environment Fixes:** Resolved multiple issues preventing fresh clones from running successfully:
  * Fixed `init.sql` failing to grant privileges by explicitly declaring `DB_USER` in `.env.example`.
  * Fixed the API container crashing by explicitly passing `DATABASE_URL` with the `db` hostname in `docker-compose.yml`, preventing it from trying to connect to localhost inside the container.
  * Fixed SSL connection rejection errors by updating the SSL bypass logic in `database.js` and `migrate.js` to allow `db:5432` connections to bypass SSL, similar to localhost.
  * Updated `.env.example` to remove outdated Cloudflare R2 variables and include optional Supabase variables for local storage mocking.
* **Database:** Migrated local Postgres to Supabase, implemented missing form DTOs/mappers, fixed SSL certificates, and increased the database connection timeout for the Supabase pooler.
* **Docker:** Fixed `docker-compose.yml` issues, removed hardcoded `DATABASE_URL` override to correctly map to Supabase `.env` variables, and resolved problems on migration and seed scripts (`init.sql`).
* **Docs:** Updated `README.md` in both repos to reflect full-stack Docker Compose setup. Added `ABOUT_DOCKERIZE.md` to both repos. Added comprehensive finance module documentation and changelogs for maintenance tracking.

## ⚡ Performance Optimizations
* **Inventory Data Load (N+1 Query Elimination):** Completely rewrote heavy inventory endpoints (`findAll`, `findById`, `findAvailableFIFO`) inside `inventoryItem.model.js`.
  * Replaced 8+ correlated subqueries per row with efficient Common Table Expressions (CTEs) for batch aggregation of sales reservations and available sacks.
  * Replaced deeply nested `COALESCE` subqueries with `LATERAL JOIN`s to compute complex fallback logic exactly once per row instead of redundantly duplicating identical queries.
  * Drastically improved payload load times over remote Supabase instances.
- Optimized getBalanceSheet query in backend to use live tables for the current date, avoiding slow historical transactional joins.
- Optimized getAllBatchMarginReports query in backend by adding a limit parameter and restricting aggregates to the selected batches to avoid full history table scans.
- Sorted Pending Approval transactions from newest to oldest in backend model.
- Fixed database typo 'Kas Pabris' to 'Kas Pabrik'.
