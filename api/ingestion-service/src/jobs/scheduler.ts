/**
 * Scheduled ingestion (Architecture §4.4, PRD FR-16).
 *
 * Wraps `node-cron` so the API container can refresh city scores on a
 * weekly (default) or monthly cron expression. The schedule is
 * configured via the `INGESTION_CRON` env var; a monthly schedule is
 * the safe default.
 *
 *   - `startScheduler({ pool })`  → starts the cron, returns a handle.
 *   - `stopScheduler()`           → cancels the cron task.
 *   - `setSchedule(expr)`         → re-arm with a new cron expression.
 *
 * Honours the `INGESTION_DISABLED=1` env to opt out (handy in dev and
 * in the testcontainers integration test). When disabled, the
 * scheduler returns a no-op handle so callers don't have to branch.
 */
import cron, { type ScheduledTask } from 'node-cron';
import type { Pool } from 'pg';
import { runIngestion, type IngestionReport } from './ingestion.js';

const DEFAULT_CRON = '0 3 1 * *'; // 03:00 on the 1st of every month
const DISABLED = process.env.INGESTION_DISABLED === '1';

let currentTask: ScheduledTask | null = null;
let currentExpr: string | null = null;

export interface SchedulerHandle {
  /** The cron expression this handle is armed with. */
  expr: string;
  /** Manually trigger a single ingestion pass now. */
  runNow: () => Promise<IngestionReport>;
  /** Stop the cron task. */
  stop: () => void;
}

export function isSchedulerEnabled(): boolean {
  return !DISABLED;
}

export function startScheduler(
  pool: Pool,
  options: { cron?: string } = {},
): SchedulerHandle | null {
  if (DISABLED) {
    // eslint-disable-next-line no-console
    console.log('[ingestion] scheduler disabled via INGESTION_DISABLED=1');
    return null;
  }
  const expr = options.cron ?? process.env.INGESTION_CRON ?? DEFAULT_CRON;
  if (!cron.validate(expr)) {
    throw new Error(`Invalid cron expression: ${expr}`);
  }
  if (currentTask) {
    currentTask.stop();
  }
  currentTask = cron.schedule(expr, async () => {
    try {
      const report = await runIngestion(pool);
      // eslint-disable-next-line no-console
      console.log(
        `[ingestion] scheduled pass complete: updated=${report.updated} skipped=${report.skipped} durationMs=${report.durationMs}`,
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[ingestion] scheduled pass failed:', err);
    }
  });
  currentExpr = expr;
  // eslint-disable-next-line no-console
  console.log(`[ingestion] scheduler armed with cron "${expr}"`);

  return {
    expr,
    async runNow() {
      return runIngestion(pool);
    },
    stop() {
      stopScheduler();
    },
  };
}

export function stopScheduler(): void {
  if (currentTask) {
    currentTask.stop();
    currentTask = null;
    currentExpr = null;
  }
}

export function getCurrentSchedule(): string | null {
  return currentExpr;
}
