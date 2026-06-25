/**
 * Vitest setup for the @relocatewise/web-quiz-mfe workspace.
 *
 * - Registers @testing-library/jest-dom matchers (`toBeInTheDocument`,
 *   etc.) onto vitest's `expect` global so the wizard's step
 *   components can use the standard RTL assertions.
 * - Initialises i18next so `useTranslation()` returns the bundled
 *   English strings by default (the wizard's tests assert on the
 *   English copy).
 *
 * The container workspace owns the canonical i18n bundle at
 * `web/container/src/i18n/`. The MFE shares the same module
 * instance via the Vite alias, so importing it from this workspace
 * gives the wizard the same English translations the rest of the
 * app uses.
 */
import * as matchers from '@testing-library/jest-dom/matchers';
import { expect } from 'vitest';

expect.extend(matchers);

if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = (v: unknown): unknown =>
    JSON.parse(JSON.stringify(v));
}

await import('../../container/src/i18n');