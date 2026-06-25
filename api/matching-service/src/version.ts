/**
 * Build / version for the API. The /api/health endpoint returns this
 * string so the CEO can confirm which SHA is running.
 *
 * Resolution order:
 *   1. `GIT_SHA` env var — set at deploy time
 *   2. `git rev-parse --short HEAD` — at build time (we capture at
 *      import time so the value is stable for the life of the process)
 *   3. `dev` — fallback for local dev / tests
 */
import { execSync } from 'node:child_process';

function resolve(): string {
  if (process.env.GIT_SHA) return process.env.GIT_SHA;
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'dev';
  }
}

export const version: string = resolve();
