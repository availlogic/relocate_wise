/**
 * Vitest setup — runs before every test file.
 *
 * - Registers @testing-library/jest-dom matchers (toBeInTheDocument, etc.)
 *   onto vitest's `expect` global.
 * - Polyfills structuredClone for jsdom so libs that depend on it work.
 */
import * as matchers from '@testing-library/jest-dom/matchers';
import { expect } from 'vitest';

expect.extend(matchers);

if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = (v: unknown): unknown =>
    JSON.parse(JSON.stringify(v));
}
