/**
 * Bug 6 / FTC-16 (v0.4.x): landmark URLs for Vancouver and Tel Aviv
 * must point at the latest available Wikimedia Commons rendition.
 *
 *   - Vancouver: `Vancouver-Skyline-Night_(44931772).jpg`
 *   - Tel Aviv:  `Tel Aviv Skyline 01.jpg`
 *
 * The `LANDMARK_BY_SLUG` map in `postgres.repository.ts` is the
 * authoritative source (used when the DB row's
 * `landmark_image_url` is missing — e.g. on a fresh in-process boot
 * seed). The in-memory `cities.seed.ts` and the JSON mirror at
 * `/db/seeds/cities.json` are kept in sync via the `cities.seed-sync`
 * test and must agree with `LANDMARK_BY_SLUG`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SEED_CITIES } from '../src/db/cities.seed.js';
import type { City } from '@relocatewise/shared';

// LANDMARK_BY_SLUG is not exported, so we re-read the source file and
// pluck the slug→URL mapping. The list is small enough that a regex
// parse is fine and avoids making a private export public.
function readLandmarkMap(): Map<string, string> {
  const src = readFileSync(
    join(process.cwd(), 'src', 'db', 'postgres.repository.ts'),
    'utf8',
  );
  const block = src.match(
    /const LANDMARK_BY_SLUG = new Map<string, string>\(\[(.*?)\]\)/s,
  );
  if (!block || block[1] === undefined) {
    throw new Error('LANDMARK_BY_SLUG not found in postgres.repository.ts');
  }
  const body = block[1];
  const rows = [...body.matchAll(/\['([^']+)',\s*'([^']+)'\]/g)];
  const map = new Map<string, string>();
  for (const row of rows) {
    const slug = row[1];
    const url = row[2];
    if (slug && url) map.set(slug, url);
  }
  return map;
}

const EXPECTED_VANCOUVER_FILENAME = 'Vancouver-Skyline-Night_(44931772).jpg';
const EXPECTED_TEL_AVIV_FILENAME = 'Tel Aviv Skyline 01.jpg';

function fileName(url: string): string {
  const m = url.match(/Special:FilePath\/(.+)$/);
  if (!m || m[1] === undefined) {
    throw new Error(`Not a Wikimedia FilePath URL: ${url}`);
  }
  return decodeURIComponent(m[1]);
}

describe('Bug 6 / FTC-16: landmark URLs (v0.4.x)', () => {
  it('LANDMARK_BY_SLUG maps vancouver-ca to the new filename', () => {
    const map = readLandmarkMap();
    expect(map.get('vancouver-ca')).toBeDefined();
    expect(fileName(map.get('vancouver-ca')!)).toBe(
      EXPECTED_VANCOUVER_FILENAME,
    );
  });

  it('LANDMARK_BY_SLUG maps tel-aviv-il to the new filename', () => {
    const map = readLandmarkMap();
    expect(map.get('tel-aviv-il')).toBeDefined();
    expect(fileName(map.get('tel-aviv-il')!)).toBe(EXPECTED_TEL_AVIV_FILENAME);
  });

  it('SEED_CITIES carries the new Vancouver filename', () => {
    const vancouver = SEED_CITIES.find((c: City) => c.slug === 'vancouver-ca');
    expect(vancouver).toBeDefined();
    expect(fileName(vancouver!.landmark_image_url)).toBe(
      EXPECTED_VANCOUVER_FILENAME,
    );
  });

  it('SEED_CITIES carries the new Tel Aviv filename', () => {
    const telAviv = SEED_CITIES.find((c: City) => c.slug === 'tel-aviv-il');
    expect(telAviv).toBeDefined();
    expect(fileName(telAviv!.landmark_image_url)).toBe(
      EXPECTED_TEL_AVIV_FILENAME,
    );
  });

  it('db/seeds/cities.json carries the new Vancouver filename', () => {
    const raw = readFileSync(
      join(process.cwd(), '..', '..', 'db', 'seeds', 'cities.json'),
      'utf8',
    );
    const parsed = JSON.parse(raw) as City[];
    const vancouver = parsed.find((c) => c.slug === 'vancouver-ca');
    expect(vancouver).toBeDefined();
    expect(fileName(vancouver!.landmark_image_url)).toBe(
      EXPECTED_VANCOUVER_FILENAME,
    );
  });

  it('db/seeds/cities.json carries the new Tel Aviv filename', () => {
    const raw = readFileSync(
      join(process.cwd(), '..', '..', 'db', 'seeds', 'cities.json'),
      'utf8',
    );
    const parsed = JSON.parse(raw) as City[];
    const telAviv = parsed.find((c) => c.slug === 'tel-aviv-il');
    expect(telAviv).toBeDefined();
    expect(fileName(telAviv!.landmark_image_url)).toBe(
      EXPECTED_TEL_AVIV_FILENAME,
    );
  });
});
