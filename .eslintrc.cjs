/* eslint-env node */
module.exports = {
  root: true,
  env: { browser: true, es2021: true, webextensions: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: { react: { version: 'detect' } },
  plugins: ['react', 'react-refresh'],
  ignorePatterns: ['dist', 'node_modules', '*.config.js', '*.config.cjs'],
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'react/prop-types': 'off',
    'react-refresh/only-export-components': 'off',
    'no-empty': ['error', { allowEmptyCatch: true }],
  },
};
