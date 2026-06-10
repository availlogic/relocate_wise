/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Where Vite forwards `/api/*` requests during local dev.
 *
 * Architecture §10.1: "Vite is configured to proxy /api/* to
 * http://localhost:3000." This works for both deploy paths:
 *
 *   - No-Docker dev: the API listens directly on :3000.
 *   - Docker dev:   docker-compose.yml exposes the API on host:3000
 *                   (the `api.ports` mapping), so the same target works.
 *     To use Caddy on host :8080 instead, set
 *     `API_PROXY_TARGET=http://localhost:8080 npm run dev`.
 *
 * The proxy only runs in the dev server, not in `vite build`. In
 * production, the Netlify function in `netlify/functions/proxy.ts`
 * takes over the same forwarding role.
 */
const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: API_PROXY_TARGET,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.{test,spec}.{ts,tsx}'],
    css: false,
  },
});
