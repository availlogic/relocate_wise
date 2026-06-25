/**
 * Minimal ESLint config for the gateway workspace (Phase B).
 *
 * Pure Node.js/TypeScript microservice. Only the src/ directory is
 * linted (test/, dist/, node_modules/ are excluded). Type-aware
 * rules are disabled; only the typescript-eslint parser is used
 * so the script is a no-op pass on Node-only TS code.
 */
module.exports = {
  root: true,
  env: { node: true, es2022: true },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: false,
  },
  plugins: ['@typescript-eslint'],
  rules: {},
  ignorePatterns: ['dist/**', 'node_modules/**', 'coverage/**', 'test/**'],
};