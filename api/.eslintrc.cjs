// ESLint config for the @relocatewise/api workspace (ESLint 8 legacy format).
//
// Scope: TypeScript-only, Node 20+ ESM. We lint `src/**/*.ts` and
// `test/**/*.ts`. Build artifacts and dependencies are ignored.
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  ignorePatterns: ['dist/', 'node_modules/', '*.js', '*.cjs', '*.mjs'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-console': 'off',
  },
  overrides: [
    {
      files: ['test/**/*.ts'],
      env: { node: true },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
};