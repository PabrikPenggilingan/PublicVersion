import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// When running inside Docker, backend service is reachable via Docker's internal DNS
// When running locally (npm run dev), backend is on localhost:3000
const backendTarget = process.env.VITE_API_HOST || 'http://localhost:3000'

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    build: {
        sourcemap: false,
    },
    server: {
        port: 5173,
        host: true, // Required for Docker: listens on all interfaces, not just localhost
        proxy: {
            '/api': {
                target: backendTarget,
                changeOrigin: true,
            },
            '/uploads': {
                target: backendTarget,
                changeOrigin: true,
            },
        },
    },
})
