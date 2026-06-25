#!/usr/bin/env node
/**
 * Redirect script for the web/ parent directory.
 *
 * The `web/` directory is the parent of 4 sibling npm workspaces
 * (container, quiz-mfe, compare-mfe, dashboard-mfe), not a workspace
 * itself. Running `npm run dev` / `npm test` / `npm install` from
 * this directory used to fail with a cryptic `ENOENT … package.json`
 * error. This script intercepts every script invocation and prints
 * a self-explanatory message.
 *
 * The proper workflow is to run commands from the repo root using
 * the `npm -w <workspace>` flag. Example:
 *
 *   npm install
 *   npm -w @relocatewise/web-container run dev
 *   npm -w @relocatewise/web-quiz-mfe test
 *   npm -w @relocatewise/web-container run build
 *   npm -w @relocatewise/web-container exec -- npx playwright test
 */
const path = require('node:path');
const fs = require('node:fs');

const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'),
);
const invokedScript = process.env.npm_lifecycle_event ?? '(unknown)';
const siblings = fs
  .readdirSync(__dirname, { withFileTypes: true })
  .filter((d) => {
    if (!d.isDirectory()) return false;
    const full = path.join(__dirname, d.name);
    return fs.existsSync(path.join(full, 'package.json'));
  })
  .map((d) => d.name)
  .sort();

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;

const lines = [
  '',
  yellow(`✗ \`${invokedScript}\` cannot run from ${pkg.name}.`),
  '',
  `  ${bold('web/')} is the parent directory of ${siblings.length} sibling npm workspaces:`,
  ...siblings.map((s) => `    • ${cyan('@relocatewise/' + s)}`),
  '',
  `  It is ${bold('not')} a workspace itself. The root ${bold('package.json')} at the repo root`,
  '  declares the 8 workspaces (3 api, 4 web, 1 shared).',
  '',
  `  ${bold('Run from the repo root')} (${path.relative(process.cwd(), path.join(__dirname, '..')) || '..'}) and target the workspace with ${bold('-w')}:`,
  '',
  '    cd ..',
  '    npm install',
  `    npm -w @relocatewise/${siblings[0] ?? '<workspace>'} run ${invokedScript}`,
  '',
  '  See the workspace map in README.md for the full list.',
  '',
];

process.stderr.write(lines.join('\n'));
process.exit(1);
