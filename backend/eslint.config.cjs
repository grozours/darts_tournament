const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');
const unicornModule = require('eslint-plugin-unicorn');
const unicorn = unicornModule.default ?? unicornModule;

const compat = new FlatCompat({
  baseDirectory: __dirname,
  resolvePluginsRelativeTo: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

module.exports = [
  ...compat.extends(
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ),
  unicorn.configs['flat/recommended'],
  ...compat.config({
    env: {
      node: true,
      es2021: true,
    },
    parser: '@typescript-eslint/parser',
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    plugins: ['@typescript-eslint'],
    rules: {
      complexity: ['warn', 15],
      'max-depth': ['warn', 4],
      'max-lines': ['warn', 500],
      'max-lines-per-function': ['warn', 120],
      'max-params': ['warn', 5],
      'max-statements': ['warn', 30],
    },
  }),
  {
    ignores: ['dist', 'node_modules'],
  },
];
