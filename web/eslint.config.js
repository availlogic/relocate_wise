/**
 * ESLint config for the @relocatewise/web workspace (ESLint 9 flat config).
 *
 * Scope: TypeScript + React, browser/Vite. Lints `src/**` and `test/**`.
 * The web workspace already declares `eslint` ^9.11.1 in devDependencies
 * and uses `@typescript-eslint` implicitly via TypeScript itself. We
 * intentionally keep the rule set minimal to avoid blocking this phase
 * on tooling churn: catch undefined identifiers and obvious bugs, leave
 * stylistic concerns to Prettier / formatters that are not yet present.
 */
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['dist/', 'node_modules/', 'e2e/', '*.cjs', '*.mjs'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
];