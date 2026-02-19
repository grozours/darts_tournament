module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'unicorn'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:unicorn/recommended'],
  ignorePatterns: ['dist', 'node_modules'],
  rules: {
    complexity: ['warn', 15],
    'max-depth': ['warn', 4],
    'max-lines': ['warn', 500],
    'max-lines-per-function': ['warn', 120],
    'max-params': ['warn', 5],
    'max-statements': ['warn', 30],
  },
};
