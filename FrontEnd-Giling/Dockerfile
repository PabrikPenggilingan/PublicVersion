FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files and install ALL deps (including devDependencies for build)
COPY package*.json ./
RUN npm ci

# Bust cache to ensure latest source is always copied
ARG CACHEBUST=1
# Copy source and build
COPY . .
RUN npm run build

# --- Stage 2: Serve with NGINX ---
FROM nginx:alpine

# Copy built static files from builder stage.
# Kept in /opt/dist and synced on start: docker-compose mounts the named volume
# `frontend_dist` over /usr/share/nginx/html, and Docker only seeds a named volume
# the first time — without this sync, rebuilt images would keep serving the old bundle.
COPY --from=builder /app/dist /opt/dist
COPY --from=builder /app/dist /usr/share/nginx/html

# Tambahkan ARG untuk memilih file nginx
ARG NGINX_CONF=nginx.conf
COPY ${NGINX_CONF} /etc/nginx/conf.d/default.conf


EXPOSE 80

CMD ["sh", "-c", "rm -rf /usr/share/nginx/html/* && cp -r /opt/dist/. /usr/share/nginx/html/ && nginx -g 'daemon off;'"]
