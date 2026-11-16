# 📊 Full-Stack User Resource & Cost Consumption Report (1 Day)

> **Simulation Mode:** 🌐 Real Playwright Browser (Frontend + Backend)  
> **Simulated Profile:** Light Day (Off-season / Slow Day)  
> **Frontend Service:** `https://gabah-frontend-staging-615541393276.asia-southeast1.run.app`  
> **Backend Service:** `https://gabah-api-staging-615541393276.asia-southeast1.run.app/api`  
> **Run Window:** 2026-10-15T14:24:53.059Z → 2026-10-15T14:25:17.243Z (24 seconds)  
> **Exchange Rate:** 1 USD = Rp 16.000  

---

## 💡 Executive Summary

| Cost Component | 1 Single User-Day | 30 Days (1 User) | 10 Users / Month | 50 Users / Month |
|---|---|---|---|---|
| **Marginal User Activity (Compute/Egress)** | **$0.0034** (Rp 54) | **$0.10** (Rp 1.629) | **$1.02** (Rp 16.292) | **$5.09** (Rp 81.459) |
| **Fixed Base Subscription (Supabase Pro)** | **$0.83** (Rp 13.333) | **$25.00** (Rp 400.000) | **$25.00** (Rp 400.000) | **$25.00** (Rp 400.000) |
| **Total Realistic Monthly Bill** | **$0.84** (Rp 13.388) | **$25.10** (Rp 401.629) | **$26.02** (Rp 416.292) | **$30.09** (Rp 481.459) |
| **Frontend Asset Requests** | 91 | 2,730 | 27,300 | 136,500 |
| **Backend API Calls** | 78 | 2,340 | 23,400 | 117,000 |
| **Total HTTP Requests** | 169 | 5,070 | 50,700 | 253,500 |
| **Database Rows Inserted** | 0 | 0 | 0 | 0 |
| **Database Disk Growth** | 0 B | 0 B | 0 B | 0 B |
| **Storage Uploads (Photos)** | 26 files (7.66 KB) | 780 files | 7800 files | 39000 files |
| **Total Network Egress** | 24.68 MB | 740.50 MB | 7.23 GB | 36.16 GB |

### 🖥️ Client-Side Browser Computation & Footprint
* **Peak Browser JS Heap Memory:** 38.3 MB
* **Average Browser JS Heap Memory:** 19.6 MB
* **Average Rendered DOM Nodes:** 544 elements
* **First Contentful Paint (FCP):** 186 ms
* **Client DOM Processing / Render Time:** 63 ms
* **Client-Side Image Processing:** HTML5 Canvas resizing & binary quality compression in browser before upload (reduces payload from ~1.5MB to ≤200KB, saving cloud bandwidth & Cloud Run CPU).
* **Client-Side Computing:** React 18 Virtual DOM reconciliation, state management, input validation, and real-time total calculations performed directly on the client machine.

---

## 💰 Detailed Cost Breakdown

| Component | Resource | Usage | Unit Price | Daily (USD) | Daily (IDR) | 30-Day Cost | Metric Source | Notes |
|---|---|---|---|---|---|---|---|---|
| **GCP Cloud Run (Frontend)** | Static Asset Requests | 91 requests | $0.000000 | $0.000036 | Rp 1 | $0.0011 | Playwright telemetry | HTML, JS chunks, CSS, icons |
| **GCP Cloud Run (Frontend)** | Asset Delivery CPU | 0.51 vCPU-seconds | $0.000034 | $0.000017 | Rp 0 | $0.0005 | estimated from latency | Nginx container 0.25 vCPU |
| **GCP Cloud Run (Frontend)** | Asset Delivery Memory | 0.13 GiB-seconds | $0.000003 | $0.000000 | Rp 0 | $0.000013 | estimated from latency | 256 MiB container |
| **GCP Cloud Run (Frontend)** | Frontend Asset Egress | 0.0240 GB | $0.12 | $0.0029 | Rp 46 | $0.09 | Playwright asset transfer | downloaded bundles & assets |
| **GCP Cloud Run (Backend)** | API Requests | 78 requests | $0.000000 | $0.000031 | Rp 0 | $0.0009 | Playwright API intercept | - |
| **GCP Cloud Run (Backend)** | API Compute CPU | 11.42 vCPU-seconds | $0.000034 | $0.0004 | Rp 6 | $0.01 | estimated from latency | assumes 1 vCPU, concurrency 1 |
| **GCP Cloud Run (Backend)** | API Compute Memory | 5.71 GiB-seconds | $0.000003 | $0.000020 | Rp 0 | $0.0006 | estimated from latency | assumes 0.5 GiB, concurrency 1 |
| **GCP Cloud Run (Backend)** | API Network Egress | 0.0001 GB | $0.12 | $0.000017 | Rp 0 | $0.0005 | API response bytes | - |
| **Supabase DB** | DB Disk Growth (kept 1 month) | 0.0000 GB-month | $0.13 | $0.00 | Rp 0 | $0.00 | pg_stat + pg_database_size | 0 rows inserted |
| **Supabase DB** | DB Egress (approx.) | 0.0001 GB | $0.09 | $0.000013 | Rp 0 | $0.0004 | proxy: API response bytes | DB to Cloud Run traffic |
| **Supabase Storage** | File Storage Growth (kept 1 month) | 0.0000 GB-month | $0.02 | $0.000000 | Rp 0 | $0.000005 | Playwright telemetry | 26 files uploaded |
| **TOTAL** | - | - | - | **$0.0034** | **Rp 54** | **$0.10** | - | - |

---

## 🎯 Quota & Free Tier Utilization

Shows how much of the Cloud Run free tier or Supabase Pro allowance 1 user consumes in a single day:

| Quota / Allowance | Single Day Usage | Plan Allowance | % Used per Day | Max Users Covered by Allowance |
|---|---|---|---|---|
| Cloud Run Free Requests / Month | 169 | 2,000,000 | 0.01% | 394 users |
| Cloud Run Free vCPU-Seconds / Month | 12 | 180,000 | 0.01% | 502 users |
| Cloud Run Free GiB-Seconds / Month | 6 | 360,000 | 0.00% | 2011 users |
| Supabase Pro DB Disk (8 GB) | 0.0000 | 8 | 0.00% | Exhausts in ~Infinity days |
| Supabase Pro Storage (100 GB) | 0.0000 | 100 | 0.00% | Exhausts in ~13685213 days |
| Supabase Pro Egress (250 GB / Month) | 0.0001 | 250 | 0.00% | 59734 users |

---

## 📦 Frontend Static Asset Delivery (Cloud Run)

| Asset Type | Requests | Total Bandwidth | Avg Download Latency |
|---|---|---|---|
| `document` | 15 | 11.53 KB | 57 ms |
| `stylesheet` | 30 | 1.62 MB | 9 ms |
| `script` | 15 | 20.43 MB | 35 ms |
| `other` | 1 | 555.00 B | 78 ms |
| `image` | 15 | 1.79 MB | 6 ms |
| `font` | 15 | 706.88 KB | 14 ms |

---

## 📈 Cumulative Long-Term Growth (Single User)

| Horizon | Database Size | File Storage Size | Monthly DB Cost | Monthly Storage Cost | % of Supabase DB Quota (8 GB) |
|---|---|---|---|---|---|
| **30 Days** | 0.000 GB | 0.000 GB | $0.00 | $0.000005 | 0.0% |
| **90 Days** | 0.000 GB | 0.001 GB | $0.00 | $0.000014 | 0.0% |
| **365 Days** | 0.000 GB | 0.003 GB | $0.00 | $0.000057 | 0.0% |

---

## 🌐 Backend API Endpoints Profile

| Endpoint | Calls | Success | Failed | Avg Latency | p95 Latency | Uploaded | Downloaded |
|---|---|---|---|---|---|---|---|
| `GET /api/batches` | 19 | 19 | 0 | 153 ms | 258 ms | 5.57 KB | 41.70 KB |
| `GET /api/auth/me` | 15 | 14 | 1 | 97 ms | 120 ms | 4.39 KB | 4.64 KB |
| `GET /api/processes` | 9 | 9 | 0 | 154 ms | 279 ms | 2.64 KB | 7.25 KB |
| `GET /api/dashboard/timeline` | 4 | 4 | 0 | 165 ms | 278 ms | 1.17 KB | 8.25 KB |
| `GET /api/inventory/category-stats` | 4 | 4 | 0 | 136 ms | 155 ms | 1.17 KB | 3.10 KB |
| `GET /api/finance/dashboard` | 3 | 3 | 0 | 175 ms | 193 ms | 900.00 B | 18.54 KB |
| `GET /api/inventory` | 3 | 3 | 0 | 149 ms | 175 ms | 900.00 B | 16.10 KB |
| `GET /api/finance/report` | 3 | 3 | 0 | 221 ms | 242 ms | 900.00 B | 11.16 KB |
| `GET /api/finance/recent-activity` | 3 | 3 | 0 | 164 ms | 177 ms | 900.00 B | 8.28 KB |
| `GET /api/batches/margins/reports` | 3 | 3 | 0 | 138 ms | 148 ms | 900.00 B | 7.62 KB |
| `GET /api/finance/balance-sheet` | 3 | 3 | 0 | 180 ms | 199 ms | 900.00 B | 978.00 B |
| `POST /api/inventory` | 1 | 1 | 0 | 310 ms | 310 ms | 751.00 B | 6.99 KB |
| `GET /api/inventory/:id` | 1 | 1 | 0 | 140 ms | 140 ms | 300.00 B | 6.95 KB |
| `GET /api/sales-v2/sales` | 1 | 1 | 0 | 124 ms | 124 ms | 300.00 B | 3.27 KB |
| `POST /api/auth/login` | 1 | 1 | 0 | 204 ms | 204 ms | 342.00 B | 571.00 B |
| `POST /api/batches` | 1 | 1 | 0 | 114 ms | 114 ms | 346.00 B | 339.00 B |
| `GET /api/batches/:id` | 1 | 1 | 0 | 106 ms | 106 ms | 300.00 B | 336.00 B |
| `GET /api/sales-v2/sales/stats` | 1 | 1 | 0 | 145 ms | 145 ms | 300.00 B | 120.00 B |
| `GET /api/batches/:id/purchases` | 1 | 1 | 0 | 128 ms | 128 ms | 300.00 B | 118.00 B |
| `GET /api/batches/:id/completion` | 1 | 0 | 1 | 109 ms | 109 ms | 300.00 B | 32.00 B |

---
*Generated automatically by Belanja Giling Cost Bot on 2026-10-15T14:25:17.901Z*