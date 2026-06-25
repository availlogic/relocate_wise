/**
 * Playwright config for the RelocateWise E2E suite.
 *
 * The suite runs against the locally-built web bundle served by Vite's
 * preview server, and a separately-bootstrapped Fastify API. The API
 * is started by this config via a `webServer` entry so a single
 * `npx playwright test` invocation spins the whole stack up.
 *
 * After the Phase B microservices split (v1.0.0 GA) the API is the
 * matching service. The Vite preview command is now the **container**
 * workspace (`web/container`) which builds the container shell + the
 * lazy-loaded MFE chunks.
 *
 * The default project is Chromium only — the E2E scenarios in
 * docs/E2E-Test-Scenarios.md are platform-agnostic.
 */
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      // The matching service. Fastify runs from the matching-service
      // workspace, no DB needed because the in-memory seed has all 40
      // cities.
      command: 'npm -w @relocatewise/matching-service run dev',
      cwd: '..',
      url: 'http://127.0.0.1:3000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      // Vite preview of the container's production build.
      command: `npm -w @relocatewise/web-container run build && npm -w @relocatewise/web-container run preview -- --port ${PORT} --strictPort`,
      cwd: '..',
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});