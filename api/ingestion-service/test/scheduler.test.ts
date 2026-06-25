/**
 * Tests for the ingestion scheduler (Architecture §4.4, PRD FR-16).
 *
 * - `startScheduler` is a no-op when `INGESTION_DISABLED=1` is set.
 * - `startScheduler` rejects an invalid cron expression.
 * - The handle exposes `runNow` which calls `runIngestion`.
 * - `stopScheduler` cancels the task.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runIngestionMock = vi.fn();
vi.mock('../src/jobs/ingestion.js', () => ({
  runIngestion: (...args: unknown[]) => runIngestionMock(...args),
}));

describe('ingestion scheduler', () => {
  beforeEach(() => {
    runIngestionMock.mockReset();
    delete process.env.INGESTION_DISABLED;
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.INGESTION_DISABLED;
  });

  it('returns null and is a no-op when INGESTION_DISABLED=1', async () => {
    process.env.INGESTION_DISABLED = '1';
    const sched = await import('../src/jobs/scheduler.js');
    const handle = sched.startScheduler({} as never);
    expect(handle).toBeNull();
    sched.stopScheduler();
  });

  it('rejects an invalid cron expression', async () => {
    const sched = await import('../src/jobs/scheduler.js');
    expect(() => sched.startScheduler({} as never, { cron: 'not-a-cron' })).toThrow(
      /Invalid cron expression/,
    );
  });

  it('arms a task and exposes a runNow handle (mocked ingestion)', async () => {
    runIngestionMock.mockResolvedValue({
      cities: 0, updated: 0, skipped: 0, errors: [], durationMs: 0,
    });
    const sched = await import('../src/jobs/scheduler.js');
    const handle = sched.startScheduler({} as never, { cron: '*/5 * * * *' });
    expect(handle).not.toBeNull();
    expect(handle!.expr).toBe('*/5 * * * *');
    const report = await handle!.runNow();
    expect(report).toBeDefined();
    expect(runIngestionMock).toHaveBeenCalledTimes(1);
    handle!.stop();
  });
});
