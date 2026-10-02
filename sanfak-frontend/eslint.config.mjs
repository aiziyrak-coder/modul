import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import boundaries from 'eslint-plugin-boundaries';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      'coverage',
      'storybook-static',
      'tools/generators/templates',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      boundaries,
    },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: {
      'import/resolver': {
        typescript: { alwaysTryTypes: true, project: './tsconfig.json' },
      },
      'boundaries/include': ['src/**/*'],
      'boundaries/elements': [
        { type: 'shared', pattern: 'src/shared/**' },
        { type: 'app', pattern: 'src/app/**' },
        { type: 'widgets', pattern: 'src/widgets/**' },
        { type: 'module', pattern: 'src/modules/*', capture: ['name'] },
        { type: 'moduleInternal', pattern: 'src/modules/*/**', capture: ['name'] },
      ],
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'warn',
      'no-empty': ['error', { allowEmptyCatch: true }],
      '@typescript-eslint/ban-ts-comment': ['error', { 'ts-expect-error': false }],
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'shared', allow: ['shared'] },

            { from: 'app', allow: ['shared', 'app', 'widgets', 'module'] },

            { from: 'widgets', allow: ['shared', 'app'] },

            {
              from: ['module', 'moduleInternal'],
              allow: ['shared', 'app'],
            },
            {
              from: [['moduleInternal', { name: '${name}' }]],
              allow: [
                ['module', { name: '${name}' }],
                ['moduleInternal', { name: '${name}' }],
              ],
            },
            {
              from: [['module', { name: '${name}' }]],
              allow: [
                ['module', { name: '${name}' }],
                ['moduleInternal', { name: '${name}' }],
              ],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/test/**', '**/*.stories.tsx'],
    rules: { 'boundaries/element-types': 'off' },
  },
  {
    files: ['src/modules/*/*.module.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  prettier,
);
