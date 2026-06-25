/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@relocatewise/web-container/api': resolve(REPO_ROOT, 'web/container/src/api.ts'),
      '@relocatewise/web-container/i18n/why': resolve(REPO_ROOT, 'web/container/src/i18n/why.ts'),
      '@relocatewise/web-container/state/shortlist': resolve(REPO_ROOT, 'web/container/src/state/shortlist.tsx'),
      '@relocatewise/web-container/state/matchResults': resolve(REPO_ROOT, 'web/container/src/state/matchResults.ts'),
      '@relocatewise/web-container/components/ShortlistBar': resolve(REPO_ROOT, 'web/container/src/components/ShortlistBar.tsx'),
      '@relocatewise/web-container/components/Toast': resolve(REPO_ROOT, 'web/container/src/components/Toast.tsx'),
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