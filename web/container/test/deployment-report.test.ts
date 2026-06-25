/**
 * Regression tests for `artifacts/Deployment_Report.md`.
 *
 * The Deployment_Report has historically drifted from reality:
 *   - Phase B split `api/` into 3 workspaces but the report kept
 *     describing the monolithic `api/Dockerfile`.
 *   - Phase D split `web/` into 4 workspaces but the report kept
 *     saying `cd web && npm run dev`.
 *   - Phase B replaced Caddy with the gateway service but the
 *     report kept mentioning Caddy.
 *   - The README + Deployment_Report quick-start was rewritten in
 *     Phase G; this file mirrors those checks so the report can't
 *     silently regress.
 *
 * This test scans `artifacts/Deployment_Report.md` and asserts that
 * it documents the current 8-workspace monorepo layout, the gateway
 * (not Caddy), the 3 Dockerfiles, and the claymorphism design
 * system.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../../../');
const REPORT_PATH = join(REPO_ROOT, 'artifacts/Deployment_Report.md');

const ALL_WORKSPACES = [
  '@relocatewise/shared',
  '@relocatewise/matching-service',
  '@relocatewise/ingestion-service',
  '@relocatewise/gateway',
  '@relocatewise/web-container',
  '@relocatewise/web-quiz-mfe',
  '@relocatewise/web-compare-mfe',
  '@relocatewise/web-dashboard-mfe',
];

describe('artifacts/Deployment_Report.md (drift guard)', () => {
  it('exists', () => {
    expect(existsSync(REPORT_PATH)).toBe(true);
  });

  describe('(must NOT contain obsolete paths)', () => {
    const report = readFileSync(REPORT_PATH, 'utf8');

    it('does NOT mention the obsolete `api/Dockerfile` (the monolith)', () => {
      // Match `api/Dockerfile` as a standalone path (not as
      // `api/matching-service/Dockerfile` or `api/ingestion-service/Dockerfile`).
      const monolith = report.match(/(?<![\w/-])api\/Dockerfile\b/g) ?? [];
      expect(monolith).toEqual([]);
    });

    it('does NOT mention the obsolete `web/Dockerfile` (no such Dockerfile exists)', () => {
      const webDockerfile = report.match(/(?<![\w/-])web\/Dockerfile\b/g) ?? [];
      expect(webDockerfile).toEqual([]);
    });

    it('does NOT mention `Caddy` / `Caddyfile` (replaced by the gateway in Phase B)', () => {
      // Allow `Cloudflare` etc. — only flag the standalone Caddy/Caddyfile.
      const caddyLines = report
        .split('\n')
        .filter((l) => /\bCaddy(?:file)?\b/.test(l));
      expect(
        caddyLines,
        `Found stale Caddy references:\n${caddyLines.join('\n')}`,
      ).toEqual([]);
    });

    it('does NOT mention the obsolete single `@relocatewise/api` workspace', () => {
      // The monolith was `@relocatewise/api`. The current workspaces
      // are `@relocatewise/matching-service` etc.
      const monolith = report.match(/@relocatewise\/api\b/g) ?? [];
      expect(monolith).toEqual([]);
    });

    it('does NOT mention the obsolete single `@relocatewise/web` workspace', () => {
      // The monolith was `@relocatewise/web`. The current workspaces
      // are `@relocatewise/web-container` etc. — anything ending in
      // `-container`, `-quiz-mfe`, `-compare-mfe`, `-dashboard-mfe`
      // is fine; the standalone `@relocatewise/web` is not.
      const monolith = report.match(/@relocatewise\/web(?![-a-z])/g) ?? [];
      expect(monolith).toEqual([]);
    });
  });

  describe('(must contain current paths)', () => {
    const report = readFileSync(REPORT_PATH, 'utf8');

    it('lists all 8 current workspaces by name', () => {
      for (const name of ALL_WORKSPACES) {
        expect(report).toContain(name);
      }
    });

    it('mentions each of the 3 api Dockerfiles', () => {
      expect(report).toContain('api/matching-service/Dockerfile');
      expect(report).toContain('api/ingestion-service/Dockerfile');
      expect(report).toContain('api/gateway/Dockerfile');
    });

    it('references the gateway service (Phase B replacement for Caddy)', () => {
      expect(report).toMatch(/gateway/i);
    });

    it('references the cloudflared production overlay', () => {
      expect(report).toContain('docker-compose.cloudflared.yml');
    });

    it('references the matching service as the only writer of `matching.*`', () => {
      // Phase C schema segregation: the matching service UPSERTs the
      // scores it receives from the ingestion worker.
      expect(report).toContain('matching.city_scores');
    });

    it('documents the claymorphism design (Phase F)', () => {
      expect(report.toLowerCase()).toContain('claymorph');
    });

    it('uses the repo-root + `-w` syntax in quick-start commands', () => {
      expect(report).toMatch(/npm -w @relocatewise\/[a-z-]+\s+run dev/);
    });

    it('warns that `cd api` and `cd web` are not workspaces (Phase G redirect)', () => {
      expect(report).toMatch(/cd api.*not.*workspace|not.*workspace.*cd api/is);
      expect(report).toMatch(/cd web.*not.*workspace|not.*workspace.*cd web/is);
    });
  });
});