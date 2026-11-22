import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [],
    typecheck: {
      enabled: true,
      only: true,
      include: ['test/**/*.test-d.ts'],
      tsconfig: './tsconfig.json',
    },
  },
});
