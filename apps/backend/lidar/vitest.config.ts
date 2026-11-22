import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts', 'test/**/*.integration-spec.ts'],
    hookTimeout: 120_000,
    testTimeout: 30_000,
  },
});
