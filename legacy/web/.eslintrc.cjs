module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  ignorePatterns: ['dist', 'dist-*', 'node_modules'],
  rules: {
    '@typescript-eslint/ban-ts-comment': 0,
    '@typescript-eslint/no-explicit-any': 0,
    '@typescript-eslint/explicit-module-boundary-types': 0,
    '@typescript-eslint/no-unused-vars': 0,
    '@typescript-eslint/no-inferrable-types': 'off',
    '@typescript-eslint/no-unused-expressions': 0,
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'error',

    semi: ['warn', 'never'],
    quotes: ['warn', 'single'],
    'no-multiple-empty-lines': ['warn', { max: 1 }],
    'no-empty-function': 'off',
    '@typescript-eslint/no-empty-function': 'off',
  },
}
