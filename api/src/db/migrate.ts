/**
 * Apply the SQL migrations in /db/migrations to the database identified
 * by the given `pg.Pool`. Idempotent — each migration file is wrapped in
 * a transaction and we keep track of applied filenames in a tiny
 * `_migrations` table.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
// `migrate.ts` lives at `api/src/db/migrate.ts`. The repo's migration
// directory is `db/migrations/` at the repo root, i.e. two levels up
// from `src/db/`.
const MIGRATIONS_DIR = resolve(__dirname, '..', '..', '..', 'db', 'migrations');

export async function runMigrations(pool: Pool, dir: string = MIGRATIONS_DIR): Promise<string[]> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS _migrations (
       filename TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`,
  );

  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const applied = new Set<string>(
    (await pool.query<{ filename: string }>(`SELECT filename FROM _migrations`)).rows.map(
      (r) => r.filename,
    ),
  );

  const newlyApplied: string[] = [];
  for (const filename of files) {
    if (applied.has(filename)) continue;
    const sql = readFileSync(join(dir, filename), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(`INSERT INTO _migrations (filename) VALUES ($1)`, [filename]);
      await client.query('COMMIT');
      newlyApplied.push(filename);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  return newlyApplied;
}
