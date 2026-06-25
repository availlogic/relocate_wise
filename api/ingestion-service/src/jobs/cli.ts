/**
 * CLI for the ingestion pipeline (Architecture §4.4, PRD FR-16).
 *
 *   `tsx api/src/jobs/cli.ts`             → run a single pass
 *   `tsx api/src/jobs/cli.ts --once`      → same as default
 *   `tsx api/src/jobs/cli.ts --city=lisbon-pt` → refresh one city
 *
 * Reads `DATABASE_URL` from the environment. Exits 0 on success, 1
 * on any uncaught error.
 *
 * The pipeline is implemented in `./ingestion.ts`; the scheduler
 * lives in `./scheduler.ts`. This CLI is intentionally a thin
 * wrapper that just calls `runIngestionCli` and propagates the exit
 * code.
 */
import { runIngestionCli } from './ingestion.js';

function parseArgs(argv: readonly string[]): { onlySlug?: string } {
  const out: { onlySlug?: string } = {};
  for (const a of argv) {
    if (a.startsWith('--city=')) {
      out.onlySlug = a.slice('--city='.length);
    }
  }
  return out;
}

const invokedDirectly = import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  const { onlySlug } = parseArgs(process.argv.slice(2));
  runIngestionCli(onlySlug ? { onlySlug } : {}).then(
    (code) => {
      process.exit(code);
    },
    (err: unknown) => {
      // eslint-disable-next-line no-console
      console.error('[ingestion-cli] uncaught:', err);
      process.exit(1);
    },
  );
}
