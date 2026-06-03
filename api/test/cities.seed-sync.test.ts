/**
 * Drift check: the in-memory `SEED_CITIES` (used by tests and the
 * in-process boot seed) and the JSON mirror at `/db/seeds/cities.json`
 * (the architecture's "single source of truth") must agree.
 *
 * Run: `npm run db:export` after editing `cities.seed.ts`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SEED_CITIES } from '../src/db/cities.seed.js';
import type { City } from '@relocatewise/shared';

const JSON_PATH = join(process.cwd(), '..', 'db', 'seeds', 'cities.json');

describe('cities.seed.ts <-> db/seeds/cities.json sync', () => {
  it('the JSON file exists and parses as an array of 40 cities', () => {
    const raw = readFileSync(JSON_PATH, 'utf8');
    const parsed = JSON.parse(raw) as City[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(40);
  });

  it('JSON contents are byte-identical to SEED_CITIES (modulo formatting)', () => {
    const raw = readFileSync(JSON_PATH, 'utf8');
    const parsed = JSON.parse(raw) as City[];
    expect(parsed).toEqual(SEED_CITIES);
  });
});
