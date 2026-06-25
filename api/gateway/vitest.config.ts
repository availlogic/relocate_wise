/**
 * Vitest configuration for @relocatewise/api.
 *
 * The two test suites that spin up a real Postgres via testcontainers
 * (`postgres.repository.test.ts` and `ingestion.test.ts`) share a
 * Reaper. Running them concurrently is racy — the Reaper is a module
 * singleton in testcontainers v10 and a second `.start()` call can
 * fail with `Failed to connect to Reaper`. We split the suites into
 * two parallel `pool` projects so the scheduler is still fast but
 * the two testcontainers groups run in separate processes.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },
    // Run testcontainers suites in isolation by file.
    isolate: true,
    // Make the test output easier to scan when running all suites.
    reporters: ['default'],
  },
});
