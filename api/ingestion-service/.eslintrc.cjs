/**
 * Minimal ESLint config for the ingestion-service workspace (Phase B).
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