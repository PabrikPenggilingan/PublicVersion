# 🐳 About Dockerizing the Frontend

This document explains how the **FrontEnd-Giling** application is containerized, how it integrates with the backend stack, and how to build and run it.

---

## Architecture Overview

The frontend uses a **multi-stage Docker build** to keep the final image small and production-ready:

```
┌──────────────────────────────────┐
│  Stage 1: Builder (node:18-alpine) │
│  - npm install                   │
│  - npm run build → /app/dist/    │
└────────────────┬─────────────────┘
                 │ copies /app/dist
                 ▼
┌──────────────────────────────────┐
│  Stage 2: Server (nginx:alpine)  │
│  - serves /usr/share/nginx/html  │
│  - ~20MB final image size        │
└──────────────────────────────────┘
```

There is **no Node.js at runtime**. The React app is compiled into static HTML/CSS/JS files, which NGINX serves directly. This makes the container fast, lightweight, and production-safe.

---

## Files Added

| File | Purpose |
|------|---------|
| [`Dockerfile`](./Dockerfile) | Multi-stage build: builds React app, serves via NGINX |
| [`nginx.conf`](./nginx.conf) | NGINX config embedded in the image for SPA routing |
| [`.dockerignore`](./.dockerignore) | Excludes `node_modules/`, `dist/`, test artifacts from the build context |

---

## How It Fits in the Full Stack

The frontend container is orchestrated by the **`docker-compose.yml` in the `BackEnd-Giling` repository**. It does not need to be run independently.

```
BackEnd-Giling/
└── docker-compose.yml   ◄── orchestrates everything
    ├── db               (PostgreSQL)
    ├── api              (Node.js backend)
    ├── frontend         (this repo — React/Vite built image)
    └── nginx            (entry point, proxies /api/* to api, serves /* from frontend)
```

The built static files are shared from the `frontend` container to the main `nginx` container via a named Docker volume (`frontend_dist`). The main NGINX container is the **single public entry point** on port 80.

---

## Building Standalone (for testing)

> ⚠️ Normally you don't need this — just use `docker-compose up` from `BackEnd-Giling/`.

```bash
# From this directory (FrontEnd-Giling/)
docker build -t gabah-frontend .
docker run -p 8080:80 gabah-frontend
# Visit http://localhost:8080
```

Note: When running standalone, API calls to `/api/` will fail since there's no backend. This is only useful for testing that the build and NGINX config work correctly.

---

## Deployment (Full Stack)

```bash
# Prerequisites: Both repos must be cloned as siblings:
#   /some/folder/BackEnd-Giling/
#   /some/folder/FrontEnd-Giling/

cd BackEnd-Giling/
cp .env.example .env
# (Optional) Fill in SUPABASE_URL and SUPABASE_KEY for file uploads

docker-compose up -d --build
# Access the app at http://localhost
```

---

## Environment Variables at Build Time

The Vite build reads environment variables prefixed with `VITE_` at **build time** (not runtime). Currently, the frontend proxies all `/api/` requests through NGINX, so no `VITE_` variables are needed for the backend URL.

If you need to configure a build-time variable in the future, add it to the `docker-compose.yml` under the `frontend` service's `build.args` section.
