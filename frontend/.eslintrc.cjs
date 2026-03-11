module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', 'node_modules'],
  rules: {
    complexity: ['warn', 15],
    'max-depth': ['warn', 4],
    'max-lines': ['warn', 400],
    'max-lines-per-function': ['warn', 120],
    'max-params': ['warn', 5],
    'max-statements': ['warn', 30],
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
  },
  overrides: [
    {
      files: ['src/**/*.{ts,tsx}'],
      rules: {
        complexity: 'off',
        'max-depth': 'off',
        'max-lines': 'off',
        'max-lines-per-function': 'off',
        'max-params': 'off',
        'max-statements': 'off',
        'react-refresh/only-export-components': 'off',
        'react-hooks/exhaustive-deps': 'off',
      },
    },
  ],
};
