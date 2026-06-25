/**
 * Ingestion service entrypoint.
 *
 * Boots the cron scheduler that periodically calls `runIngestion()`.
 * The matching service does all schema writes (via the internal PUT
 * endpoint); this service only reads `matching.cities` and writes
 * `ingestion.pipeline_logs`. See Architecture v1.4.0 §4.5 and
 * Database.md §1.4 for the role boundary.
 *
 * Environment variables:
 *   - `INGESTION_DATABASE_URL`  — `ingestion_service` role connection string.
 *   - `INGESTION_TARGET_URL`    — base URL of the matching service's
 *                                 internal endpoint, e.g. `http://matching:3000`.
 *   - `INGESTION_TARGET_TOKEN`  — bearer token shared with the matching service.
 *   - `INGESTION_DISABLED=1`    — exit immediately (useful in dev / tests).
 *   - `INGESTION_CRON`          — standard 5-field cron expression. Default
 *                                 `0 3 1 * *` (03:00 UTC on the 1st of every month).
 */
import cron from 'node-cron';
import { runIngestion } from './jobs/ingestion.js';
import { getIngestionPool, closePool } from './db/pool.js';

const DEFAULT_CRON = '0 3 1 * *';

function log(message: string): void {
  // eslint-disable-next-line no-console
  console.log(`[ingestion-service] ${message}`);
}

async function main(): Promise<void> {
  if (process.env.INGESTION_DISABLED === '1') {
    log('INGESTION_DISABLED=1 — exiting without arming the scheduler.');
    return;
  }

  const pool = getIngestionPool();
  const expr = process.env.INGESTION_CRON ?? DEFAULT_CRON;
  if (!cron.validate(expr)) {
    throw new Error(`Invalid INGESTION_CRON expression: ${expr}`);
  }

  log(`arming cron "${expr}" (target=${process.env.INGESTION_TARGET_URL ?? '(noop)'})`);
  const task = cron.schedule(expr, async () => {
    try {
      const report = await runIngestion(pool);
      log(
        `scheduled pass complete: updated=${report.updated} skipped=${report.skipped} durationMs=${report.durationMs}`,
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[ingestion-service] scheduled pass failed:', err);
    }
  });

  const shutdown = async (signal: string): Promise<void> => {
    log(`received ${signal}, stopping scheduler and closing pool`);
    task.stop();
    await closePool();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[ingestion-service] failed to start:', err);
  process.exit(1);
});