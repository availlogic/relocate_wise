/**
 * Regression tests for the redirect markers in `api/package.json` and
 * `web/package.json`.
 *
 * Background: Phases B + D split the `api/` and `web/` directories into
 * 3 and 4 sibling npm workspaces respectively. Each parent directory is
 * no longer a workspace itself, but users naturally `cd api && npm
 * install` expecting it to work — which used to fail with a cryptic
 * `ENOENT … package.json` error.
 *
 * The fix was to ship a stub `package.json` + `redirect.cjs` in each
 * parent. Running any script from those directories now exits 1 with
 * a self-explanatory error pointing the user at the repo root + the
 * `-w` flag.
 *
 * This test:
 *   1. Asserts both `api/package.json` and `web/package.json` exist
 *      with the correct `name` and `private: true` markers.
 *   2. Asserts the redirect script handles every common script name
 *      (dev, start, test, build, lint, typecheck).
 *   3. Spawns the redirect script with each `npm_lifecycle_event` and
 *      asserts it exits non-zero with a useful message.
 *   4. Asserts the root README documents the monorepo layout with the
 *      "Read this first" warning section so users see the redirect
 *      before they hit it.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../../../');

const PARENTS = [
  { dir: 'api', pkgName: '@relocatewise/api-parent' },
  { dir: 'web', pkgName: '@relocatewise/web-parent' },
] as const;

const SCRIPTS = ['dev', 'start', 'test', 'build', 'lint', 'typecheck'] as const;

describe('Monorepo redirect markers (api/ + web/ parents)', () => {
  for (const { dir, pkgName } of PARENTS) {
    const pkgPath = join(REPO_ROOT, dir, 'package.json');
    const scriptPath = join(REPO_ROOT, dir, 'redirect.cjs');

    describe(`${dir}/package.json`, () => {
      it('exists', () => {
        expect(existsSync(pkgPath), `${pkgPath} not found`).toBe(true);
      });

      it(`declares name = "${pkgName}"`, () => {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        expect(pkg.name).toBe(pkgName);
      });

      it('is private', () => {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        expect(pkg.private).toBe(true);
      });

      it('intercepts every common script', () => {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        for (const s of SCRIPTS) {
          expect(
            pkg.scripts[s],
            `Missing ${s} script in ${pkgPath}`,
          ).toBe(`node ./redirect.cjs`);
        }
      });
    });

    describe(`${dir}/redirect.cjs`, () => {
      it('exists and is executable JavaScript', () => {
        expect(existsSync(scriptPath), `${scriptPath} not found`).toBe(true);
      });

      for (const s of SCRIPTS) {
        it(`exits non-zero with a helpful message for npm_lifecycle_event=${s}`, () => {
          const result = spawnSync('node', [scriptPath], {
            env: { ...process.env, npm_lifecycle_event: s },
            encoding: 'utf8',
          });
          expect(result.status).not.toBe(0);
          const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
          expect(combined).toContain(pkgName);
          expect(combined).toContain(`cannot run from`);
          expect(combined).toContain('-w');
          expect(combined).toMatch(/cd\s+\.\./);
        });
      }
    });
  }
});

describe('Root README documents the monorepo layout', () => {
  const readmePath = join(REPO_ROOT, 'README.md');

  it('exists', () => {
    expect(existsSync(readmePath)).toBe(true);
  });

  it('warns that api/ and web/ are NOT workspaces', () => {
    const readme = readFileSync(readmePath, 'utf8');
    expect(readme).toMatch(/api\/.*NOT.*workspace/is);
    expect(readme).toMatch(/web\/.*NOT.*workspace/is);
  });

  it('includes the npm -w usage example', () => {
    const readme = readFileSync(readmePath, 'utf8');
    expect(readme).toMatch(/npm -w @relocatewise\/[a-z-]+\s+run/);
  });

  it('lists all 8 workspaces by name', () => {
    const readme = readFileSync(readmePath, 'utf8');
    const expected = [
      '@relocatewise/shared',
      '@relocatewise/matching-service',
      '@relocatewise/ingestion-service',
      '@relocatewise/gateway',
      '@relocatewise/web-container',
      '@relocatewise/web-quiz-mfe',
      '@relocatewise/web-compare-mfe',
      '@relocatewise/web-dashboard-mfe',
    ];
    for (const name of expected) {
      expect(readme).toContain(name);
    }
  });
});

describe('Root package.json declares exactly the 8 workspaces', () => {
  const rootPkgPath = join(REPO_ROOT, 'package.json');

  it('exists', () => {
    expect(existsSync(rootPkgPath)).toBe(true);
  });

  it('declares the 8 expected workspaces and no parents', () => {
    const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));
    expect(rootPkg.workspaces).toEqual([
      'shared',
      'api/matching-service',
      'api/ingestion-service',
      'api/gateway',
      'web/container',
      'web/quiz-mfe',
      'web/compare-mfe',
      'web/dashboard-mfe',
    ]);
  });

  it('does NOT list api/ or web/ as workspaces', () => {
    const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'));
    const list = rootPkg.workspaces as string[];
    expect(list).not.toContain('api');
    expect(list).not.toContain('web');
  });
});