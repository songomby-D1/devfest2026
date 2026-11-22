import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import importPlugin from 'eslint-plugin-import';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const root = dirname(fileURLToPath(import.meta.url));
const frontend = 'apps/frontend';
const backendServices = ['gateway', 'auth', 'content', 'nft', 'lidar'].map(
  (service) => `apps/backend/${service}`,
);
const applications = [frontend, ...backendServices];
// Like CI workspace detection, an app directory without package.json is a placeholder: its
// files have no TypeScript project yet, so typed linting starts when the app is initialized.
const placeholders = applications.filter(
  (directory) => !existsSync(join(root, directory, 'package.json')),
);
const appFiles = (directory) =>
  `${directory}/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}`;
const unusedNames = {
  args: 'all',
  argsIgnorePattern: '^_',
  caughtErrors: 'all',
  caughtErrorsIgnorePattern: '^_',
  destructuredArrayIgnorePattern: '^_',
  varsIgnorePattern: '^_',
};
const boundaryMessage =
  'Use an HTTP contract or approved shared types instead of importing app source.';

const applicationBoundaries = applications.map((directory) => {
  const peers = applications.filter((application) => application !== directory);

  return {
    name: `boundaries/${directory}`,
    files: [appFiles(directory)],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: `(?:^|/)(?:${peers.join('|')})(?:/|$)`,
              message: boundaryMessage,
            },
            {
              regex:
                '(?:^|/)packages/shared(?:/|$)|^@devfest2026/shared(?:/|$)',
              allowTypeImports: true,
              message: 'Shared contracts are type-only.',
            },
          ],
        },
      ],
      'import/no-restricted-paths': [
        'error',
        {
          basePath: root,
          zones: [{ target: directory, from: peers, message: boundaryMessage }],
        },
      ],
    },
  };
});

export default defineConfig([
  globalIgnores([
    '**/dist/',
    '**/build/',
    '**/coverage/',
    '**/node_modules/',
    '**/generated/',
    '**/*.generated.*',
    ...placeholders.map((directory) => `${directory}/`),
    // Standalone tool with its own lockfile and TypeScript 7 toolchain, outside the app scope of
    // the code policy. Its owner runs its typecheck and tests in scripts/3d.
    'scripts/3d/',
    // Draco decoder copied from three by apps/frontend/scripts/copy-draco.mjs before dev and build.
    'apps/frontend/public/draco/',
  ]),
  {
    name: 'quality/base',
    files: ['**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}'],
    extends: [js.configs.recommended],
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-unused-vars': ['error', unusedNames],
    },
  },
  {
    name: 'quality/typed',
    files: ['**/*.{ts,mts,cts,tsx}'],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: root },
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', unusedNames],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-check': false,
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': true,
          'ts-nocheck': true,
        },
      ],
    },
  },
  {
    name: 'boundaries/typescript-resolution',
    files: applications.map(appFiles),
    plugins: { import: importPlugin },
    settings: {
      'import/resolver': {
        typescript: {
          project: applications.map(
            (directory) => `${root}/${directory}/tsconfig.json`,
          ),
        },
      },
    },
  },
  {
    name: 'frontend/react',
    files: [appFiles(frontend)],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    name: 'frontend/jsx-accessibility',
    files: [`${frontend}/**/*.{jsx,tsx}`],
    extends: [jsxA11y.flatConfigs.recommended],
  },
  {
    name: 'scripts/node',
    files: ['scripts/**/*.{js,mjs,cjs}', '*.{js,mjs,cjs}'],
    languageOptions: { globals: globals.node },
  },
  ...backendServices.map((directory) => ({
    name: `nestjs/${directory}`,
    files: [appFiles(directory)],
    languageOptions: { globals: globals.node },
    extends: [
      {
        files: ['**/*.{ts,mts,cts,tsx}'],
        rules: {
          // Nest modules are classes that can be empty apart from the @Module() decorator.
          '@typescript-eslint/no-extraneous-class': [
            'error',
            { allowWithDecorator: true },
          ],
          // Nest factory options are declared as classes and accept object literals.
          '@typescript-eslint/no-unsafe-class-instance-assignment': 'off',
        },
      },
    ],
  })),
  ...applicationBoundaries,
  {
    name: 'quality/test-spies',
    files: ['**/*.spec.ts', '**/*.test.{ts,tsx}'],
    rules: { '@typescript-eslint/unbound-method': 'off' },
  },
  prettier,
]);
