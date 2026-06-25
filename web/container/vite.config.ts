/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Where Vite forwards `/api/*` requests during local dev.
 *
 * Architecture §10.1: "Vite is configured to proxy /api/* to
 * http://localhost:3000." With the Phase B microservice split the
 * matching service listens on :3000 by default; the gateway sits
 * in front of it in production.
 *
 *   - No-Docker dev: the matching service listens directly on :3000.
 *   - Docker dev:   docker-compose.yml exposes the gateway on host:3000
 *                   (the `gateway.ports` mapping), so the same target works.
 *
 * The proxy only runs in the dev server, not in `vite build`. In
 * production, Cloudflare Pages' `/api/*` forward rule sends calls
 * to the gateway via Cloudflare Tunnel (docker-compose.cloudflared.yml).
 */
const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';

/**
 * Module aliases for the MFE workspaces. The container bundles each
 * MFE as its own chunk via `manualChunks`; the source-level imports
 * resolve via Vite's resolve.alias so dynamic imports work in dev
 * (where chunks are not split the same way as in production).
 *
 * Tests in the container workspace may also load MFE source files
 * (e.g., App.test.tsx mocks the MFE entry points but still renders
 * the actual components), so we resolve the MFE-internal aliases
 * (`@relocatewise/web-container/state/shortlist`, etc.) here too.
 */
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // The shared package is a published-style workspace with
      // `main`/`types` pointing at `dist/`. npm workspaces resolve
      // it correctly; no alias needed.
      '@relocatewise/web-quiz-mfe': resolve(REPO_ROOT, 'web/quiz-mfe/src/index.ts'),
      '@relocatewise/web-compare-mfe': resolve(REPO_ROOT, 'web/compare-mfe/src/index.ts'),
      '@relocatewise/web-dashboard-mfe': resolve(REPO_ROOT, 'web/dashboard-mfe/src/index.ts'),
      '@relocatewise/web-container/api': resolve(REPO_ROOT, 'web/container/src/api.ts'),
      '@relocatewise/web-container/state/shortlist': resolve(REPO_ROOT, 'web/container/src/state/shortlist.tsx'),
      '@relocatewise/web-container/state/matchResults': resolve(REPO_ROOT, 'web/container/src/state/matchResults.ts'),
      '@relocatewise/web-container/i18n/why': resolve(REPO_ROOT, 'web/container/src/i18n/why.ts'),
      '@relocatewise/web-container/components/ShortlistBar': resolve(REPO_ROOT, 'web/container/src/components/ShortlistBar.tsx'),
      '@relocatewise/web-container/components/Toast': resolve(REPO_ROOT, 'web/container/src/components/Toast.tsx'),
    },
  },
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
    // Per Architecture §3 (Phase D, v1.0.0 GA): each MFE is loaded
    // as its own chunk so the Container shell + the matched route's
    // MFE chunk are the only assets the browser fetches on first
    // paint. E2E-7 verifies this contract.
    rollupOptions: {
      output: {
        manualChunks: {
          'quiz-mfe': ['@relocatewise/web-quiz-mfe'],
          'compare-mfe': ['@relocatewise/web-compare-mfe'],
          'dashboard-mfe': ['@relocatewise/web-dashboard-mfe'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.{test,spec}.{ts,tsx}'],
    css: false,
  },
});