/**
 * Vitest setup for the @relocatewise/web-compare-mfe workspace.
 *
 * Registers @testing-library/jest-dom matchers (`toBeInTheDocument`,
 * etc.) onto vitest's `expect` global so the wizard's step components
 * can use the standard RTL assertions.
 */
import * as matchers from '@testing-library/jest-dom/matchers';
import { expect } from 'vitest';

expect.extend(matchers);

if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = (v: unknown): unknown =>
    JSON.parse(JSON.stringify(v));
}