import { globalIgnores } from 'eslint/config';
import eslintJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import wxtAutoImports from './.wxt/eslint-auto-imports.mjs';

export default [
  globalIgnores([
    '.wxt/**',
    '.output/**',
    'node_modules/**',
    '.prd/**',
    'coverage/**',
    'test-results/**',
    'playwright-report/**',
    '.agents/**',
    '.claude/**',
  ]),

  wxtAutoImports,

  eslintJs.configs.recommended,

  ...tseslint.configs.recommended,

  reactHooks.configs.flat.recommended,

  {
    rules: {
      'no-empty': 'error',
      'no-console': 'warn',
      'prefer-const': 'error',
      '@typescript-eslint/explicit-function-return-type': ['warn', {
        allowExpressions: true,
      }],
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
    },
  },

  {
    files: ['components/ui/**/*.tsx'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },

  {
    files: ['components/shared/**/*.tsx'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },

  {
    files: ['entrypoints/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },

  {
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'off',
      'no-constant-binary-expression': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },

  {
    files: ['tests/e2e/**/*.ts'],
    rules: {
      'no-empty-pattern': 'off',
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },

  {
    files: ['*.config.{ts,js}'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },

  {
    files: ['tests/screenshots/**/*.mjs'],
    languageOptions: {
      globals: {
        crypto: 'readonly',
        TextEncoder: 'readonly',
        btoa: 'readonly',
        document: 'readonly',
        chrome: 'readonly',
        console: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
];
