/**
 * Vitest setup for the @relocatewise/web-dashboard-mfe workspace.
 *
 * - Registers @testing-library/jest-dom matchers (`toBeInTheDocument`,
 *   etc.) onto vitest's `expect` global.
 * - Initialises i18next so `useTranslation()` returns the bundled
 *   English strings by default (the dashboard's tests assert on
 *   English copy).
 *
 * The container workspace owns the canonical i18n bundle at
 * `web/container/src/i18n/`. The MFE shares the same module
 * instance via the Vite alias.
 */
import * as matchers from '@testing-library/jest-dom/matchers';
import { expect } from 'vitest';

expect.extend(matchers);

if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = (v: unknown): unknown =>
    JSON.parse(JSON.stringify(v));
}

await import('../../container/src/i18n');