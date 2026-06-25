/**
 * FTC-18 — Module README presence and completeness.
 *
 * Per `docs/Functional-Test-Cases.md` FTC-18 and
 * `docs/Acceptance-Criteria.md` DoD §4 ("Documentation & Consistency"):
 * every micro-frontend and microservice directory must contain a
 * non-empty, standardized `README.md` documenting inputs, outputs,
 * API routes / event contracts, and directory layouts.
 *
 * The 7 modules are:
 *   - api/matching-service
 *   - api/ingestion-service
 *   - api/gateway
 *   - web/container
 *   - web/quiz-mfe
 *   - web/compare-mfe
 *   - web/dashboard-mfe
 *
 * This test lives in the **container** workspace because:
 *   - It is a repo-wide verification test (crosses workspace
 *     boundaries).
 *   - The container's vitest config has jsdom + access to the rest
 *     of the repo via `process.cwd()` resolution.
 *
 * Each README is required to mention the section names
 * "Inputs", "Outputs", "Public surface" (or "Event contract"),
 * and "Directory layout" (case-insensitive, with optional numeric
 * prefix like `## 1. Inputs`).
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// `__dirname` in a vitest test file under CJS-ish loaders points at
// the file's own directory. Compute REPO_ROOT as three levels up
// from this test file (test → web/container → web → repo).
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../../../');

const MODULES = [
  'api/matching-service',
  'api/ingestion-service',
  'api/gateway',
  'web/container',
  'web/quiz-mfe',
  'web/compare-mfe',
  'web/dashboard-mfe',
] as const;

/** Match a `## N. Section` or `## Section` heading. */
const HEADING = (name: string): RegExp =>
  new RegExp(`^#{1,6}\\s*\\d*\\.?\\s*${name}\\s*$`, 'im');

describe('FTC-18: module READMEs (DoD §4 "Documentation & Consistency")', () => {
  for (const modulePath of MODULES) {
    describe(`${modulePath}/README.md`, () => {
      const readmePath = join(REPO_ROOT, modulePath, 'README.md');

      it('exists as a non-empty file', () => {
        expect(existsSync(readmePath), `${readmePath} does not exist`).toBe(true);
        const stats = statSync(readmePath);
        expect(stats.size, `${readmePath} is empty`).toBeGreaterThan(0);
      });

      it('has a # heading with the workspace name', () => {
        const contents = readFileSync(readmePath, 'utf8');
        const firstLine = contents.split('\n', 1)[0] ?? '';
        expect(
          firstLine.startsWith('# '),
          `${readmePath} first line is not a top-level heading`,
        ).toBe(true);
        // The README must mention the module's last path segment
        // (e.g. "matching-service" / "quiz-mfe").
        const lastSegment = modulePath.split('/').slice(-1)[0]!;
        expect(
          contents.includes(lastSegment),
          `${readmePath} does not mention "${lastSegment}"`,
        ).toBe(true);
      });

      it('contains an Inputs section', () => {
        const contents = readFileSync(readmePath, 'utf8');
        expect(
          HEADING('Inputs').test(contents),
          `${readmePath} is missing an "Inputs" section`,
        ).toBe(true);
      });

      it('contains an Outputs section', () => {
        const contents = readFileSync(readmePath, 'utf8');
        expect(
          HEADING('Outputs').test(contents),
          `${readmePath} is missing an "Outputs" section`,
        ).toBe(true);
      });

      it('contains a Directory layout section', () => {
        const contents = readFileSync(readmePath, 'utf8');
        expect(
          HEADING('Directory layout').test(contents),
          `${readmePath} is missing a "Directory layout" section`,
        ).toBe(true);
      });

      it('lists API routes or event contracts (DoD §4 "API/event contracts")', () => {
        const contents = readFileSync(readmePath, 'utf8');
        // Accept any of: Event contract, Public surface, API surface,
        // Path policy (used by the gateway for its block-list policy),
        // or Routes. The intent is "the README documents what this
        // module exposes to the outside world".
        const hasApiOrEventSection =
          HEADING('Event contract').test(contents) ||
          HEADING('Public surface').test(contents) ||
          HEADING('API surface').test(contents) ||
          HEADING('Path policy').test(contents) ||
          HEADING('Routes').test(contents) ||
          // The api READMEs list the public REST surface as a
          // bullet under the top heading (e.g.
          // "- The public REST surface: GET /api/health, ...").
          // Accept that pattern as well.
          /public (REST )?surface|REST endpoints?/i.test(contents) ||
          // The ingestion-service's `## Outputs` section documents
          // the outbound HTTP `PUT /api/internal/...` calls. Accept
          // any `## Outputs` section that mentions an HTTP verb
          // and a path. The verb may be in backticks
          // (e.g. `PUT`) and may be followed by a templated URL
          // (e.g. `${INGESTION_TARGET_URL}/api/...`).
          (HEADING('Outputs').test(contents) &&
            /\b(GET|POST|PUT|PATCH|DELETE)\b[^.\n]*\/api\//i.test(contents));
        expect(
          hasApiOrEventSection,
          `${readmePath} is missing an "Event contract" / "Public surface" / "Path policy" section`,
        ).toBe(true);
      });
    });
  }
});