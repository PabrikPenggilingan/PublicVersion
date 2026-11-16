# SYSTEM MONITORING MODULE: AI MANIFEST & SYSTEM ARCHITECTURE
> **Format:** Machine-readable & High-density Context Document for AI Agents / LLMs  
> **Module:** Super Admin System Monitoring & Infrastructure Telemetry  
> **Timestamp:** 2026-09-21T00:32:00+07:00  
> **Repo Root 1 (Backend):** `BackEnd-Giling/backend`  
> **Repo Root 2 (Frontend):** `FrontEnd-Giling`  

---

## 1. Context & Architectural Principles

### 1.1 Purpose
This module exposes telemetry across three distinct operational layers of the **Belanja Giling** rice mill management platform:
1. **Application Runtime & Compute:** GCP Cloud Run instances (`gabah-api` and `gabah-api-staging`) via Google Cloud Monitoring API.
2. **Relational Database:** Managed PostgreSQL 15+ hosted on Supabase (size, connections, top tables, row counts, user activity).
3. **Object Storage:** Supabase Storage (S3-compatible) bucket `gabah-files` (folder breakdowns, top files, storage per user).

### 1.2 Non-Negotiable Invariants
- **Do NOT touch the PostgreSQL enum `user_role` (`admin`, `owner`, `operator`, `viewer`):** The system relies heavily on this enum. Adding a new role string breaks multiple views, triggers, and client components. Super Admin status MUST ALWAYS be managed via the boolean column `sys.users.is_super_admin`.
- **Defensive SQL Queries:** When querying `trx.files.created_by`, always use `(to_jsonb(f)->>'created_by')::uuid` to prevent SQL column resolution failures if migrations are desynchronized.
- **Fail-Safe Graceful Degradation:**
  - If `SUPABASE_SERVICE_ROLE_KEY` is missing or invalid, do NOT throw 500. Return `{ source: 'database_estimate', warning: ... }` using `trx.files`.
  - If GCP ADC/Service Account is missing locally or returns empty time series (idle container / 0 instances), do NOT throw 500. Return `{ available: false, reason: ... }` or `{ status: 'idle', cpu: { current_percent: 0 }, ... }`.
- **Endpoint Guard Ordering:** All admin monitoring endpoints must adhere to:
  `authenticateToken` -> `superAdminLimiter` (60 req/min) -> `requireSuperAdmin` -> Handler.

---

## 2. File Change Manifest

### 2.1 Backend New Files
| File Path | Responsibility |
| :--- | :--- |
| `backend/migrations/090_add_super_admin_flag.sql` | Adds column `is_super_admin` (BOOLEAN DEFAULT false) + index `idx_users_is_super_admin` to `sys.users`. |
| `backend/migrations/091_add_created_by_to_files.sql` | Adds column `created_by` (UUID FK `sys.users(id)`) + index `idx_trx_files_created_by` to `trx.files`, with backfill from `trx.batches` & `trx.purchases`. |
| `backend/src/middleware/superAdmin.js` | Express middleware `requireSuperAdmin` validating `req.user.is_super_admin === true` with DB fallback check. |
| `backend/src/services/adminMonitoring.cache.js` | In-memory `MemoryCache` class with automatic expiry eviction. Singleton `monitoringCache`. |
| `backend/src/models/adminMonitoring.model.js` | Low-level database queries for PostgreSQL system catalogs, user telemetry, and file metrics. |
| `backend/src/services/adminMonitoring.service.js` | Business orchestration layer for Overview, Users, Database, Storage (Supabase client), and GCP Cloud Run metrics. |
| `backend/src/controllers/adminMonitoring.controller.js` | Controller endpoints handling HTTP req/res, cache hit/miss logic, and error formatting. |
| `backend/src/routes/adminMonitoring.routes.js` | Express Router mounted under `/api/admin/system`. |
| `backend/docs/Akmal/01_OVERVIEW_CHANGES_REQ_LOGIC.md` | Human-readable overview and feature requirements. |
| `backend/docs/Akmal/02_TECHNICAL_EXPLAINED.md` | Human-readable technical architecture and engineering reference. |
| `backend/docs/Akmal/03_AI_ALL_CHANGES_AND_LOGIC.md` | This file. AI-ingestible complete manifest. |

### 2.2 Backend Modified Files
| File Path | Changes Applied |
| :--- | :--- |
| `backend/src/config/env.js` | Added `SUPABASE_SERVICE_ROLE_KEY` and `GCP_PROJECT_ID` (default: `'padinadipilot2026'`) to config exports. Ensures `SUPABASE_URL` has fallback to production URL if unset. |
| `backend/src/middleware/rateLimiter.js` | Exported `superAdminLimiter`: 60 requests per 1-minute window per IP with standard rate limit headers. |
| `backend/src/controllers/auth.controller.js` | Updated login query and JWT signing to include `is_super_admin: user.is_super_admin || false` in the token payload and user response object. |
| `backend/src/app.js` | Mounted admin monitoring routes: `app.use('/api/admin/system', adminMonitoringRoutes)`. |
| `backend/.env` & `../.env` | Configured `SUPABASE_SERVICE_ROLE_KEY` and `GCP_PROJECT_ID=padinadipilot2026`. |

### 2.3 Frontend Modified & New Files
| File Path | Changes Applied |
| :--- | :--- |
| `FrontEnd-Giling/src/pages/admin/SystemMonitoring.tsx` | New complete page component. 5 tabs: Overview, Users, Database, Storage, Computing. Includes user activity drilldown modal, GCP service toggle, time window selector, and cache flush action. |
| `FrontEnd-Giling/src/api/client.ts` | Added `adminMonitoringAPI` client object with methods: `getOverview()`, `getUserActivity()`, `getUserDetail(id)`, `getDatabaseHealth()`, `getStorageUsage()`, `getComputingMetrics(service, window)`, `clearCache()`. |
| `FrontEnd-Giling/src/types/index.ts` | Added `is_super_admin?: boolean` to interface `User`. |
| `FrontEnd-Giling/src/pages/admin/MasterPage.tsx` | Added navigation button to `/system-monitoring`, rendered conditionally: `{user?.is_super_admin && (...) }`. |
| `FrontEnd-Giling/src/App.tsx` | Added route `/system-monitoring` mapped to `<SystemMonitoring />`, guarded by AuthGuard and Super Admin check. |

---

## 3. Database Schema Diff

### 3.1 `sys.users`
```sql
ALTER TABLE sys.users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_users_is_super_admin ON sys.users (is_super_admin);
```
- **Semantics:** If `true`, the user bypasses standard role checks for infrastructure telemetry.
- **Default:** `false`.
- **Elevation:** Done via direct SQL `UPDATE sys.users SET is_super_admin = true WHERE username = '...'`.

### 3.2 `trx.files`
```sql
ALTER TABLE trx.files ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES sys.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_trx_files_created_by ON trx.files (created_by);
```
- **Backfill Logic:**
  - Purchases: `UPDATE trx.files f SET created_by = p.created_by FROM trx.purchases p WHERE f.source_type = 'purchase' AND f.source_id = p.id;`
  - Batches: `UPDATE trx.files f SET created_by = b.created_by FROM trx.batches b WHERE f.source_type = 'batch' AND f.source_id = b.id;`
  - Unmatched: Defaults to active admin/owner.

---

## 4. API Specifications (JSON Schema & Contracts)

Base URL: `/api/admin/system`  
Headers: `Authorization: Bearer <jwt>`

### 4.1 `GET /overview`
- **Cache TTL:** 60 seconds
- **Response Schema:**
```json
{
  "success": true,
  "data": {
    "users": {
      "total": 12,
      "active": 10,
      "by_role": { "admin": 2, "owner": 1, "operator": 7, "viewer": 2 }
    },
    "database": {
      "database_name": "postgres",
      "total_size_mb": 45.23,
      "connections": { "total": 8, "active": 2, "idle": 6 }
    },
    "storage": {
      "total_files": 142,
      "total_size_mb": 84.50,
      "source": "supabase_storage | database_estimate"
    },
    "computing": {
      "available": true,
      "status": "active | idle",
      "service_name": "gabah-api",
      "cpu_percent": 3.45,
      "memory_percent": 18.20,
      "active_instances": 1
    },
    "cached_at": "2026-09-21T00:30:00.000Z"
  }
}
```

### 4.2 `GET /users`
- **Cache TTL:** 60 seconds
- **Response Schema:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "username": "string",
        "email": "string",
        "role": "admin | owner | operator | viewer",
        "is_super_admin": true,
        "is_active": true,
        "total_batches_created": 45,
        "total_purchases_created": 120,
        "total_sales_created": 80,
        "total_files_uploaded": 54,
        "storage_used_bytes": 35651584,
        "storage_used_mb": 34.00,
        "last_activity": "2026-09-20T23:15:00.000Z"
      }
    ]
  }
}
```

### 4.3 `GET /users/:id`
- **Response Schema:**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "activity_trend": [
      { "week": "2026-W36", "batches": 12, "purchases": 25, "sales": 15, "files": 10 }
    ],
    "recent_logs": [
      { "action": "CREATE_PURCHASE", "entity_type": "purchase", "created_at": "..." }
    ]
  }
}
```

### 4.4 `GET /database`
- **Cache TTL:** 120 seconds
- **Response Schema:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "database_name": "postgres",
      "total_size_bytes": 47427584,
      "total_size_mb": 45.23,
      "connections": { "total": 8, "active": 2, "idle": 6 }
    },
    "table_sizes": [
      {
        "table_name": "trx.journal_lines",
        "total_bytes": 12582912,
        "data_bytes": 8388608,
        "index_bytes": 4194304
      }
    ],
    "row_counts": [
      { "table_name": "trx.purchases", "count": 1450 }
    ],
    "growth_trend": [
      { "week": "2026-W37", "new_purchases": 85, "new_batches": 32, "new_sales": 70 }
    ]
  }
}
```

### 4.5 `GET /storage`
- **Cache TTL:** 180 seconds
- **Response Schema:**
```json
{
  "success": true,
  "data": {
    "source": "supabase_storage",
    "bucket_name": "gabah-files",
    "summary": {
      "total_files": 142,
      "total_size_bytes": 88604672,
      "total_size_mb": 84.50,
      "total_size_gb": 0.08
    },
    "by_folder": [
      { "folder": "struk", "files_count": 80, "size_bytes": 52428800, "size_mb": 50.00 },
      { "folder": "gabah", "files_count": 30, "size_bytes": 20971520, "size_mb": 20.00 }
    ],
    "top_files": [
      { "file_name": "struk-123.jpg", "file_size": 2450000, "created_at": "...", "uploaded_by": "user1" }
    ],
    "by_user": [
      { "username": "user1", "files_count": 95, "total_size_mb": 62.10 }
    ]
  }
}
```

### 4.6 `GET /computing?service=gabah-api&window=1h`
- **Query Params:**
  - `service`: `gabah-api` | `gabah-api-staging` (default: `gabah-api`)
  - `window`: `30m` | `1h` | `3h` | `6h` | `24h` (default: `1h`)
- **Cache TTL:** 60 seconds
- **Response Schema (Active):**
```json
{
  "success": true,
  "data": {
    "available": true,
    "status": "active",
    "project_id": "padinadipilot2026",
    "service_name": "gabah-api",
    "time_window": "1h",
    "cpu": { "current_percent": 4.12, "points": [ { "time": "...", "value": 4.12 } ] },
    "memory": { "current_percent": 19.40, "points": [ ... ] },
    "requests": { "total": 1280, "points": [ ... ] },
    "latencies": { "p99_ms": 142.50 },
    "instances": { "current": 1, "points": [ ... ] }
  }
}
```
- **Response Schema (Idle / Scale-to-Zero):**
```json
{
  "success": true,
  "data": {
    "available": true,
    "status": "idle",
    "project_id": "padinadipilot2026",
    "service_name": "gabah-api",
    "notice": "Tidak ada data time series tersedia untuk rentang waktu ini. Kontainer Cloud Run sedang dalam status standby (0 instances aktif).",
    "cpu": { "current_percent": 0, "points": [] },
    "memory": { "current_percent": 0, "points": [] },
    "requests": { "total": 0, "points": [] },
    "latencies": { "p99_ms": 0 },
    "instances": { "current": 0, "points": [] }
  }
}
```
- **Response Schema (Unavailable / Missing ADC locally):**
```json
{
  "success": true,
  "data": {
    "available": false,
    "project_id": "padinadipilot2026",
    "service_name": "gabah-api",
    "reason": "Kredensial GCP belum diatur di lingkungan lokal..."
  }
}
```

### 4.7 `POST /cache/clear`
- **Response Schema:**
```json
{
  "success": true,
  "message": "Cache monitoring berhasil dibersihkan.",
  "timestamp": "2026-09-21T00:32:00.000Z"
}
```

---

## 5. Implementation Details & Gotchas

### 5.1 Supabase Storage Bucket Initialization
If the Supabase project does not have any buckets created yet:
`adminMonitoring.service.js` attempts auto-creation:
```javascript
await supabase.storage.createBucket('gabah-files', {
  public: false,
  fileSizeLimit: 26214400 // 25 MB
});
```
Ensure that the `SUPABASE_SERVICE_ROLE_KEY` used has project-level storage permissions.

### 5.2 Google Cloud Monitoring Metric Query Alignment
- When querying `MetricServiceClient.listTimeSeries`:
  - `metric.type`: e.g. `run.googleapis.com/container/cpu/utilizations`
  - `resource.type`: `cloud_run_revision`
  - `resource.labels.service_name`: Dynamic variable (`gabah-api` or `gabah-api-staging`).
  - **Omit `resource.labels.location`:** Different revisions or staging services might be deployed in different regions (`asia-southeast1` vs `asia-southeast2`). Omitting the location label ensures all metrics for the service name in the project are matched.
  - Aggregation alignment period: `alignmentPeriod: { seconds: 60 }` (or `300` for longer windows).
  - Per-series aligner: `ALIGN_MEAN` for CPU/RAM, `ALIGN_PERCENTILE_99` for latencies, `ALIGN_MAX` for instances.

### 5.3 Local Development ADC Resolution
On Windows, `@google-cloud/monitoring` attempts to load:
`C:\Users\<User>\AppData\Roaming\gcloud\application_default_credentials.json`.
If this file does not exist, initializing the client or making a call without error handling will throw `GoogleAuthError`.
In `adminMonitoring.service.js`, the existence of credentials is checked first. If absent in local dev, it cleanly sets `available: false` and logs a non-fatal warning.

### 5.4 Token Refresh Requirement
Because `is_super_admin` is embedded in the JWT payload at login time (`auth.controller.js`), promoting an existing user in the database requires either:
1. The user logging out and logging back in, OR
2. Relying on the fallback DB query in `requireSuperAdmin` middleware (which handles live verification if the claim is missing from the token).

---

## 6. Testing & Verification Runbook

### 6.1 Backend API Verification
```bash
# 1. Test Super Admin Access (expect 200 OK)
curl -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" http://localhost:3000/api/admin/system/overview

# 2. Test Non-Super Admin Access (expect 403 Forbidden)
curl -H "Authorization: Bearer <OPERATOR_TOKEN>" http://localhost:3000/api/admin/system/overview

# 3. Test Storage Telemetry
curl -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" http://localhost:3000/api/admin/system/storage

# 4. Test Computing Telemetry (with staging toggle)
curl -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" "http://localhost:3000/api/admin/system/computing?service=gabah-api-staging&window=3h"

# 5. Flush In-Memory Cache
curl -X POST -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>" http://localhost:3000/api/admin/system/cache/clear
```

### 6.2 Frontend Route & State Verification
1. Log in with a user whose `sys.users.is_super_admin = true`.
2. Navigate to `/master-page`. Verify the **"System Monitoring"** button appears.
3. Click the button to navigate to `/system-monitoring`.
4. Verify all 5 tabs render without NaN, undefined errors, or uncaught exceptions.
5. In the Computing tab, switch between `gabah-api` and `gabah-api-staging`, change the time window between `30m`, `1h`, `24h`.
6. Open browser DevTools Network tab: verify requests hit `/api/admin/system/*` with 200 OK responses.
