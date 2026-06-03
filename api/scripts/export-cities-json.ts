/**
 * Export the in-memory `SEED_CITIES` array to `/db/seeds/cities.json`.
 *
 * Run: `npm -w @relocatewise/api run db:export`.
 *
 * The JSON file is the architecture's canonical source of truth
 * (Architecture §5.2: "Final city list is captured in db/seeds/cities.json
 * and is the single source of truth"). The TS array is the in-memory
 * twin used by tests and by the in-process boot seed.
 *
 * Keep both in sync by re-running this script after any edit to
 * `cities.seed.ts`. A divergence check lives in
 * `api/test/cities.seed-sync.test.ts`.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEED_CITIES } from '../src/db/cities.seed.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, '..', '..', 'db', 'seeds', 'cities.json');

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(SEED_CITIES, null, 2) + '\n', 'utf8');

// eslint-disable-next-line no-console
console.log(`Wrote ${SEED_CITIES.length} cities to ${outPath}`);
