# 🐳 About Dockerizing the Full Stack

This document explains the complete Docker setup for the **Belanja Giling Management System** — covering how all four services (database, API, frontend, NGINX) work together under a single `docker-compose.yml`.

---

## Architecture Overview

```
Internet
    │
    ▼ Port 80
┌─────────────────────────────────────┐
│           gabah_nginx               │
│         (nginx:alpine)              │
│                                     │
│  /api/*   ──►  gabah_api:3000       │
│  /health  ──►  gabah_api:3000       │
│  /*       ──►  /usr/share/nginx/html│ ◄── served from frontend_dist volume
└──────────────────────┬──────────────┘
                       │
          ┌────────────┴────────────┐
          │                         │
   ┌──────▼──────┐         ┌────────▼───────┐
   │  gabah_api  │         │ gabah_frontend  │
   │(node:18-alp)│         │ (nginx:alpine)  │
   │ Port 3000   │         │ Writes built    │
   │ Runs        │         │ files to the    │
   │ migrations  │         │ frontend_dist   │
   │ on startup  │         │ Docker volume   │
   └──────┬──────┘         └────────────────┘
          │
   ┌──────▼──────┐
   │  gabah_db   │
   │(postgres:14)│
   │  Port 5432  │
   └─────────────┘
```

---

## Services

| Container | Image | Purpose |
|-----------|-------|---------|
| `gabah_db` | `postgres:14-alpine` | PostgreSQL database |
| `gabah_api` | Built from `./backend/Dockerfile` | Node.js Express API |
| `gabah_frontend` | Built from `../FrontEnd-Giling/Dockerfile` | React app (builds static files) |
| `gabah_nginx` | `nginx:alpine` | Reverse proxy + static file server |

---

## Files Modified/Added

| File | Change |
|------|--------|
| [`docker-compose.yml`](./docker-compose.yml) | Added `frontend` service and `frontend_dist` named volume |
| [`nginx/conf.d/default.conf`](./nginx/conf.d/default.conf) | Added static asset caching, removed "future" comment, now properly wired |

---

## How the Frontend Is Served

The `frontend` container builds the React/Vite app and writes the output to a **named Docker volume** (`frontend_dist`). The `nginx` container mounts this same volume read-only and serves it under `location /`.

This avoids running two separate NGINX processes while keeping the build self-contained in the frontend image.

```yaml
# docker-compose.yml (simplified)
frontend:
  build: ../FrontEnd-Giling
  volumes:
    - frontend_dist:/usr/share/nginx/html  # writes built files here

nginx:
  image: nginx:alpine
  volumes:
    - frontend_dist:/usr/share/nginx/html:ro  # reads from same volume
```

---

## Quick Start (Fresh Clone)

> **Prerequisite:** Both `BackEnd-Giling` and `FrontEnd-Giling` must be cloned as **sibling folders**:
> ```
> AERP/
> ├── BackEnd-Giling/   ◄── run docker-compose from here
> └── FrontEnd-Giling/  ◄── built automatically by Docker
> ```

```bash
cd BackEnd-Giling/

# 1. Copy environment file
cp .env.example .env
# (Optional) Add SUPABASE_URL and SUPABASE_KEY for file uploads

# 2. Start everything — builds both images and runs all services
docker-compose up -d --build

# 3. Seed initial data
docker-compose exec api npm run seed

# 4. Access the app
# Frontend: http://localhost
# API:      http://localhost/api
# Health:   http://localhost/health
```

---

## Stopping & Cleaning Up

```bash
# Stop all containers (keep database data)
docker-compose down

# Stop and delete everything including database volume
docker-compose down -v

# Rebuild after code changes
docker-compose up -d --build
```

---

## Startup Order

Docker Compose enforces the following dependency chain:

```
db (healthy) → api (migrations run) → frontend (build) → nginx (serves traffic)
```

The `api` container waits for `db` to pass its healthcheck before starting. The `nginx` container waits for `frontend` to finish building its static files.

---

## Adding Environment Variables for the Frontend

Vite reads `VITE_*` variables at **build time**. To pass a build-time variable to the frontend, add a `build.args` section to the `frontend` service in `docker-compose.yml`:

```yaml
frontend:
  build:
    context: ../FrontEnd-Giling
    dockerfile: Dockerfile
    args:
      VITE_SOME_KEY: ${SOME_KEY}
```

Then reference it in `vite.config.ts` or any source file as `import.meta.env.VITE_SOME_KEY`.
