import type { Config } from 'jest';

const transform: Config['transform'] = {
  '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
};

const shared = {
  rootDir: '.',
  testEnvironment: 'node',
  transform,
  moduleFileExtensions: ['ts', 'js', 'json'],
  // The generated Prisma client imports its TypeScript files with `.js`.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
};

/**
 * Three projects: unit tests next to the code, HTTP tests against an
 * in-memory repository, and PostgreSQL integration tests (Testcontainers).
 */
const config: Config = {
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/generated/**'],
  coverageDirectory: 'coverage',
  projects: [
    {
      ...shared,
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
    },
    {
      ...shared,
      displayName: 'http',
      testMatch: ['<rootDir>/test/http/**/*.spec.ts'],
    },
    {
      ...shared,
      displayName: 'integration',
      testMatch: ['<rootDir>/test/integration/**/*.spec.ts'],
    },
  ],
};

export default config;
