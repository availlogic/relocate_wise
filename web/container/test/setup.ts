/**
 * Vitest setup — runs before every test file.
 *
 * - Registers @testing-library/jest-dom matchers (toBeInTheDocument, etc.)
 *   onto vitest's `expect` global.
 * - Polyfills structuredClone for jsdom so libs that depend on it work.
 * - Initializes i18next so `useTranslation()` returns the bundled English
 *   strings by default (tests assert on English copy; switching to
 *   Chinese is exercised by `i18n.test.tsx`).
 */
import * as matchers from '@testing-library/jest-dom/matchers';
import { expect } from 'vitest';

expect.extend(matchers);

if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = (v: unknown): unknown =>
    JSON.parse(JSON.stringify(v));
}

await import('../src/i18n');
