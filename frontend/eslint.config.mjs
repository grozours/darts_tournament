import js from '@eslint/js';
import unicorn from 'eslint-plugin-unicorn';
import { FlatCompat } from '@eslint/eslintrc';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  ...compat.config(require('./.eslintrc.cjs')),
  unicorn.configs['flat/recommended'] ?? unicorn.configs.recommended,
];
